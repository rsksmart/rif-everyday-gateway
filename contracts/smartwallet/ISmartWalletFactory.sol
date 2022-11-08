// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

interface ISmartWalletFactory {
    event Deployed(address indexed addr, uint256 salt); //Event triggered when a deploy is successful

    function createUserSmartWallet(address owner, address feeManager) external;

    function getSmartWalletAddress(address owner)
        external
        view
        returns (address);
}
