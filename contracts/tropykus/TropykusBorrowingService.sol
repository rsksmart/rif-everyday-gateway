// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "contracts/services/BorrowService.sol";
import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";
import "./ITropykus.sol";

/* solhint-disable avoid-low-level-calls */

contract TropykusBorrowingService is BorrowService {
    error InvalidCollateralAmount(uint256 amount, uint256 expectedAmount);
    error MissingIdentity(address user);
    error NonZeroAmountAllowed();
    error NonZeroCollateralAllowed();

    uint256 private constant _UNIT_DECIMAL_PRECISION = 1e18;
    // Amount that will prevent the user to get liquidated at a first instance for a price fluctuation on the collateral.
    uint256 private constant _DELTA_COLLATERAL_WITH_PRECISION = 5e18;

    address private _comptroller;
    address private _oracle;
    address private _crbtc;
    address private _cdoc;
    SmartWalletFactory private _smartWalletFactory;
    uint256 private constant _BLOCKS_PER_YEAR = 2 * 60 * 24 * 365; // blocks created every 30 seconds aprox

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    constructor(
        address gateway,
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) BorrowService(gateway, "Tropykus") {
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
        uint256 listingId,
        uint256 duration
    ) public payable override withSubscription(req.from, listingId) {
        if (amount <= 0) revert NonZeroAmountAllowed();
        if (msg.value <= 0) revert NonZeroCollateralAllowed();

        ServiceListing memory listing = listings[listingId];
        if (!listing.enabled) {
            revert ListingDisabled(listingId);
        }

        if (listing.maxAmount < amount || listing.minAmount > amount)
            revert InvalidAmount(amount);

        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );

        uint256 amountToLend = calculateRequiredCollateral(
            amount,
            listing.currency
        );
        if (msg.value < amountToLend)
            revert InvalidCollateralAmount(msg.value, amountToLend);

        smartWallet.execute{value: msg.value}(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("mint()"),
            getMarketForCurrency(listing.loanToValueCurrency),
            listing.loanToValueCurrency
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
            getMarketForCurrency(listing.currency),
            listing.currency
        );

        _removeLiquidityInternal(amount, listingId);

        emit Borrow({
            listingId: listingId,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount,
            duration: duration
        });
    }

    function pay(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 listingId
    ) public payable override {
        if (amount <= 0) revert NonZeroAmountAllowed();
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        ServiceListing memory listing = listings[listingId];

        address market = getMarketForCurrency(listing.currency);

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
            listing.currency,
            address(0)
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("approve(address,uint256)", market, amount), // max uint to repay whole debt
            listing.currency,
            address(0)
        );

        smartWallet.execute(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("repayBorrow(uint256)", type(uint256).max), // max uint to repay whole debt
            market,
            listing.currency
        );

        emit Pay({
            listingId: listingId,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount
        });
    }

    function getCollateralBalance() public view returns (uint256) {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (, bytes memory exchangeRatedata) = address(_crbtc).staticcall(
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(exchangeRatedata, (uint256));

        (, bytes memory balanceData) = address(_crbtc).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }

    // Only using RBTC as collateral after will be defining by the listing loanToValueCurrency
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
        bytes calldata sig,
        address currency
    ) public payable override {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        address market = getMarketForCurrency(currency);

        (, bytes memory balanceData) = market.call(
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
            market,
            currency
        );

        if (success) {
            (, bytes memory data) = market.call(
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

        (, bytes memory data) = getMarketForCurrency(currency).staticcall(
            abi.encodeWithSignature(
                "borrowBalanceStored(address)",
                address(smartWallet)
            )
        );

        uint256 borrowBalance = abi.decode(data, (uint256));

        return borrowBalance;
    }

    function getListing(uint256 listingId)
        public
        view
        override
        returns (ServiceListing memory)
    {
        ServiceListing memory listing = listings[listingId];
        listing.interestRate =
            IcErc20(getMarketForCurrency(listing.currency))
                .borrowRatePerBlock() *
            _BLOCKS_PER_YEAR;
        return listing;
    }

    function getMarketForCurrency(address currency)
        public
        view
        returns (address)
    {
        IcErc20[] memory markets = IComptrollerG6(_comptroller).getAllMarkets();
        for (uint256 i = 0; i < markets.length; i++) {
            if (
                currency == address(0) &&
                _compareStrings(IcErc20(markets[i]).symbol(), "kRBTC")
            ) {
                return address(markets[i]);
            } else {
                if (currency == IcErc20(address(markets[i])).underlying()) {
                    return address(markets[i]);
                }
            }
        }
        return address(0);
    }

    function _compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
