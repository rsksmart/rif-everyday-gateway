// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../services/LendingService.sol";
import "../userIdentity/UserIdentityFactory.sol";
import "../userIdentity/UserIdentity.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";

contract TropykusLendingService is LendingService {
    address private _crbtc;
    SmartWalletFactory private _smartWalletFactory;
    uint256 constant _UNIT_DECIMAL_PRECISION = 1e18;

    constructor(address crbtc, SmartWalletFactory smartWalletFactory)
        LendingService("Tropykus")
    {
        _crbtc = crbtc;
        _smartWalletFactory = smartWalletFactory;
    }

    function lend(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) public payable override {
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        (bool success, bytes memory ret) = smartWallet.execute{
            value: msg.value
        }(
            suffixData,
            req,
            sig,
            abi.encodeWithSignature("mint()"),
            address(_crbtc),
            address(0),
            0
        );

        if (success) {
            emit Lend({
                listingId: 0,
                lender: msg.sender,
                currency: address(0),
                amount: msg.value
            });
        } else {
            revert FailedOperation(ret);
        }
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
            address(0),
            0
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
}
