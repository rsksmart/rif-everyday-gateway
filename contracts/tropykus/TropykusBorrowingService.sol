// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "../userIdentity/UserIdentityFactory.sol";
import "../userIdentity/UserIdentity.sol";
import {IPriceOracleProxy, IComptrollerG6} from "contracts/tropykus/ITropykus.sol";

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
    UserIdentityFactory private _userIdentityFactory;

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    constructor(
        UserIdentityFactory userIdentityFactory,
        TropykusContracts memory contracts
    ) BorrowService("Tropykus") {
        _comptroller = contracts.comptroller;
        _oracle = contracts.oracle;
        _crbtc = contracts.crbtc;
        _cdoc = contracts.cdoc;
        _userIdentityFactory = userIdentityFactory;
    }

    function borrow(
        uint256 amount,
        address currency,
        uint256 index,
        uint256 duration
    ) public payable override {
        if (amount <= 0) revert NonZeroAmountAllowed();
        if (msg.value <= 0) revert NonZeroCollateralAllowed();

        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        if (address(identity) == address(0)) {
            identity = UserIdentityFactory(_userIdentityFactory).createIdentity(
                    msg.sender
                );
        }

        uint256 amountToLend = calculateRequiredCollateral(amount, currency);
        if (msg.value < amountToLend)
            revert InvalidCollateralAmount(msg.value, amountToLend);

        identity.send{value: msg.value}(
            address(_crbtc),
            abi.encodeWithSignature("mint()")
        );

        address[] memory markets = new address[](2);

        markets[0] = address(_crbtc); // kRBTC
        markets[1] = address(_cdoc); // kDOC

        identity.send(
            address(_comptroller),
            abi.encodeWithSignature("enterMarkets(address[])", markets)
        );

        identity.retrieveTokens(
            address(_cdoc),
            abi.encodeWithSignature("borrow(uint256)", amount),
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
        uint256 amount,
        address currency,
        uint256 index
    ) public payable override {
        if (amount <= 0) revert NonZeroAmountAllowed();
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        if (address(identity) == address(0)) {
            revert MissingIdentity(msg.sender);
        }

        identity.sendTokens(
            address(_cdoc),
            abi.encodeWithSignature("repayBorrow(uint256)", type(uint256).max), // max uint to repay whole debt
            currency,
            amount,
            _cdoc
        );

        emit Pay({
            listingId: index,
            borrower: msg.sender,
            currency: currency,
            amount: amount
        });
    }

    function getCollateralBalance() public view returns (uint256) {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);
        // If identity is 0 then The user has n't ever interacted with the protocol
        if (address(identity) == address(0)) {
            return 0;
        }

        bytes memory data = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(data, (uint256));

        bytes memory balanceData = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(identity))
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

    function withdraw() public override {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        if (address(identity) == address(0)) {
            revert MissingIdentity(msg.sender);
        }
        bytes memory balanceData = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(identity))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        identity.retrieve(
            address(_crbtc),
            abi.encodeWithSignature("redeem(uint256)", tokens)
        );

        bytes memory data = identity.read(
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
    }

    function getBalance(address currency)
        public
        view
        override(IService)
        returns (uint256)
    {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);
        if (address(identity) == address(0)) {
            return 0;
        }

        bytes memory data = identity.read(
            address(_cdoc),
            abi.encodeWithSignature(
                "borrowBalanceStored(address)",
                address(identity)
            )
        );

        uint256 borrowBalance = abi.decode(data, (uint256));

        return borrowBalance;
    }
}
