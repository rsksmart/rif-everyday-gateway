// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "contracts/services/BorrowService.sol";
import {IPriceOracleProxy, IComptrollerG6} from "contracts/tropykus/ITropykus.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";

contract TropykusBorrowingService is BorrowService {
    error InvalidCollateralAmount(uint256 amount, uint256 expectedAmount);
    error MissingIdentity(address user);
    error NonZeroAmountAllowed();
    error NonZeroCollateralAllowed();

    uint256 constant _UNIT_DECIMAL_PRECISION = 1e18;
    // Amount that will prevent the user to get liquidated at a first instance for a price fluctuation on the collateral.
    uint256 constant _DELTA_COLLATERAL_WITH_PRECISION = 5e18;

    address private _comptroller;
    address private _oracle;
    address private _crbtc;
    address private _cdoc;
    SmartWalletFactory private _smartWalletFactory;

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    constructor(
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) BorrowService("Tropykus") {
        _comptroller = contracts.comptroller;
        _oracle = contracts.oracle;
        _crbtc = contracts.crbtc;
        _cdoc = contracts.cdoc;
        _smartWalletFactory = smartWalletFactory;
    }

    function borrow(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        address currency,
        uint256 index,
        uint256 duration
    ) public payable override {
        if (amount <= 0) revert NonZeroAmountAllowed();
        if (msg.value <= 0) revert NonZeroCollateralAllowed();

        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        uint256 amountToLend = calculateRequiredCollateral(amount, currency);
        if (msg.value < amountToLend)
            revert InvalidCollateralAmount(msg.value, amountToLend);

        smartWallet.execute{value: msg.value}(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("mint()"),
            address(_crbtc),
            address(0)
        );

        address[] memory markets = new address[](2);

        markets[0] = address(_crbtc); // kRBTC
        markets[1] = address(_cdoc); // kDOC

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("enterMarkets(address[])", markets),
            address(_comptroller),
            address(0)
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("borrow(uint256)", amount),
            address(_cdoc),
            currency
        );

        emit Borrow({
            listingId: index,
            borrower: msg.sender,
            currency: currency,
            amount: amount,
            duration: duration
        });
    }

    function pay(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        address currency,
        uint256 index
    ) public payable override {
        if (amount <= 0) revert NonZeroAmountAllowed();
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                req.from,
                address(smartWallet),
                amount
            ), // max uint to repay whole debt
            currency,
            address(0)
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature(
                "approve(address,uint256)",
                address(_cdoc),
                amount
            ), // max uint to repay whole debt
            currency,
            address(0)
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("repayBorrow(uint256)", type(uint256).max), // max uint to repay whole debt
            address(_cdoc),
            currency
        );

        emit Pay({
            listingId: index,
            borrower: msg.sender,
            currency: currency,
            amount: amount
        });
    }

    function getCollateralBalance() public view returns (uint256) {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        bytes memory data = smartWallet.read(
            address(_crbtc),
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(data, (uint256));

        bytes memory balanceData = smartWallet.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));
        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }

    // Only using RBTC as collateral after will be defining by the listing loanToValueTokenAddr
    function calculateRequiredCollateral(uint256 amount, address currency)
        public
        view
        override
        returns (uint256)
    {
        uint256 rbtcPrice = IPriceOracleProxy(_oracle).getUnderlyingPrice(
            _crbtc
        );
        uint256 docPrice = IPriceOracleProxy(_oracle).getUnderlyingPrice(_cdoc);
        (, uint256 collateralFactor) = IComptrollerG6(_comptroller).markets(
            _crbtc
        );

        return
            (((amount + _DELTA_COLLATERAL_WITH_PRECISION) * docPrice) *
                _UNIT_DECIMAL_PRECISION) / (collateralFactor * rbtcPrice);
    }

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) public payable override {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        bytes memory balanceData = smartWallet.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        (bool success, bytes memory ret) = smartWallet.execute{
            value: msg.value
        }(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("redeem(uint256)", tokens),
            address(_crbtc),
            address(0)
        );

        if (success) {
            bytes memory data = smartWallet.read(
                address(_crbtc),
                abi.encodeWithSignature("exchangeRateStored()")
            );
            uint256 exchangeRate = abi.decode(data, (uint256));

            emit Withdraw({
                listingId: 0,
                withdrawer: msg.sender,
                currency: address(0),
                amount: (tokens * exchangeRate) / _UNIT_DECIMAL_PRECISION
            });
        } else {
            revert FailedOperation(ret);
        }
    }

    function getBalance(address currency)
        public
        view
        override(IService)
        returns (uint256)
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        bytes memory data = smartWallet.read(
            address(_cdoc),
            abi.encodeWithSignature(
                "borrowBalanceStored(address)",
                address(smartWallet)
            )
        );

        uint256 borrowBalance = abi.decode(data, (uint256));

        return borrowBalance;
    }
}
