// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";

contract TropykusLendingService is LendingService {
    address private _crbtc;
    SmartWalletFactory private _smartWalletFactory;
    uint256 private constant _UNIT_DECIMAL_PRECISION = 1e18;

    constructor(
        address gateway,
        address crbtc,
        SmartWalletFactory smartWalletFactory
    ) LendingService(gateway, "Tropykus") {
        _crbtc = crbtc;
        _smartWalletFactory = smartWalletFactory;
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
        {
            ServiceListing memory listing = listings[listingId];
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

        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );

        (bool success, bytes memory ret) = smartWallet.execute{
            value: amountToLend
        }(
            mtx.suffixData,
            mtx.req,
            mtx.sig,
            abi.encodeWithSignature("mint()"),
            address(_crbtc),
            address(0)
        );

        if (success) {
            _removeLiquidityInternal(amountToLend, listingId);
            emit Lend({
                listingId: listingId,
                lender: msg.sender,
                currency: address(0),
                amount: msg.value
            });
        } else {
            revert FailedOperation(ret);
        }
    }

    function withdraw(IForwarder.MetaTransaction calldata mtx)
        public
        payable
        override
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (, bytes memory balanceData) = address(_crbtc).staticcall(
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
            address(_crbtc),
            address(0)
        );

        if (success) {
            (, bytes memory exchangeRateData) = address(_crbtc).staticcall(
                abi.encodeWithSignature("exchangeRateStored()")
            );
            uint256 exchangeRate = abi.decode(exchangeRateData, (uint256));

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
        override
        returns (uint256)
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (, bytes memory exchangeRateData) = address(_crbtc).staticcall(
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(exchangeRateData, (uint256));

        (, bytes memory balanceData) = address(_crbtc).staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }
}
