// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "./IWalletFactory.sol";

interface ISmartWalletFactory is IWalletFactory {
    event Deployed(address indexed addr, uint256 salt); //Event triggered when a deploy is successful

    function createUserSmartWallet(
        address owner,
        address recoverer,
        uint256 index,
        bytes calldata sig
    ) external;

    function getSmartWalletAddress(
        address owner,
        address recoverer,
        uint256 index
    ) external view returns (address);
}
