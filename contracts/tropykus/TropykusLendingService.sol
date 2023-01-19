// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";
import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import {TropykusCommon} from "./TropykusCommon.sol";

contract TropykusLendingService is LendingService, TropykusCommon {
    address private _comptroller;
    address private _crbtc;

    constructor(
        address gateway,
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) LendingService(gateway, "Tropykus") TropykusCommon(smartWalletFactory) {
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
        address currencyToLend = listings[listingId].currency;
        uint256 _amount = msg.value > 0 ? msg.value : amount;

        if (_amount == 0) {
            revert ZeroAmountNotAllowed({currency: currencyToLend});
        }

        _onlyValidListingArgs(listingId, _amount);
        uint256 amountToLend = _validateAndGetAmountToLend(currencyToLend);
        address market = _getMarketForCurrency(
            currencyToLend,
            _comptroller,
            _crbtc
        );

        _removeLiquidityInternal(amountToLend, listingId);

        if (currencyToLend != address(0)) {
            _transferAndApproveERC20ToMarket(
                mtx,
                market,
                currencyToLend,
                amountToLend
            );
        }

        _mintTokensInMarket(mtx, currencyToLend, amountToLend, market);

        emit Lend({
            listingId: listingId,
            lender: msg.sender,
            currency: currencyToLend,
            amount: msg.value
        });
    }

    function withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId
    ) public override {
        ServiceListing memory listing = listings[listingId];
        address market = _getMarketForCurrency(
            listing.currency,
            _comptroller,
            _crbtc
        );

        _withdraw(mtx, listingId, listing.currency, market);
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
