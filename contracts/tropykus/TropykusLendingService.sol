// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";
import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import "./TropykusCommon.sol";

contract TropykusLendingService is LendingService, TropykusCommon {
    SmartWalletFactory private _smartWalletFactory;
    uint256 private constant _UNIT_DECIMAL_PRECISION = 1e18;
    address private _comptroller;
    address private _crbtc;

    struct TropykusContracts {
        address comptroller;
        address crbtc;
    }

    constructor(
        address gateway,
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) LendingService(gateway, "Tropykus") {
        _smartWalletFactory = smartWalletFactory;
        _comptroller = contracts.comptroller;
        _crbtc = contracts.crbtc;
    }

    function lend(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        address wallet
    )
        public
        payable
        override
        withSubscription(mtx.req.from, listingId, wallet)
    {
        uint256 amountToLend;
        ServiceListing memory listing = listings[listingId];

        {
            if (!listing.enabled) {
                revert ListingDisabled(listingId);
            }

            amountToLend = amount;
            if (listing.currency == address(0)) amountToLend = msg.value;
            if (amountToLend == 0) {
                revert InvalidAmount(amountToLend);
            }

            if (
                listing.maxAmount < amountToLend ||
                listing.minAmount > amountToLend
            ) {
                revert InvalidAmount(amountToLend);
            }
        }

        address market = _getMarketForCurrency(
            listing.currency,
            _comptroller,
            _crbtc
        );

        _removeLiquidityInternal(amountToLend, listingId);

        (bool success, bytes memory ret) = _mintMarketTokens(
            mtx,
            _smartWalletFactory,
            listing.currency,
            amount,
            market
        );

        if (success) {
            emit Lend({
                listingId: listingId,
                lender: msg.sender,
                currency: listing.currency,
                amount: msg.value
            });
        } else {
            revert FailedOperation(ret);
        }
    }

    function withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId
    ) public payable override {
        ServiceListing memory listing = listings[listingId];
        address market = _getMarketForCurrency(
            listing.currency,
            _comptroller,
            _crbtc
        );

        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (, bytes memory balanceData) = address(market).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        (bool success, bytes memory ret) = smartWallet.execute{
            value: msg.value
        }(
            mtx.suffixData,
            mtx.req,
            mtx.sig,
            abi.encodeWithSignature("redeem(uint256)", tokens),
            market,
            listing.currency
        );

        if (success) {
            (, bytes memory exchangeRateData) = address(market).staticcall(
                abi.encodeWithSignature("exchangeRateStored()")
            );
            uint256 exchangeRate = abi.decode(exchangeRateData, (uint256));

            emit Withdraw({
                listingId: listingId,
                withdrawer: msg.sender,
                currency: listing.currency,
                amount: (tokens * exchangeRate) / _UNIT_DECIMAL_PRECISION
            });
        } else {
            revert FailedOperation(ret);
        }
    }

    function getBalance(address currency)
        public
        view
        override
        returns (uint256)
    {
        address market = _getMarketForCurrency(currency, _comptroller, _crbtc);

        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (, bytes memory exchangeRateData) = address(market).staticcall(
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(exchangeRateData, (uint256));

        (, bytes memory balanceData) = address(market).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }
}
