// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "./SmartWallet.sol";

/**
 * @title ISmartWalletFactory
 * @dev Factory interface for creating SmartWallets
 * Based on rif-relay-contracts interfaces/SmartWalletFactory.sol
 * @author RIF protocols team
 */
interface ISmartWalletFactory {
    /**
     * @notice Emitted when a new SmartWallet is deployed successfully
     * @param addr The address of the SmartWallet
     * @param salt The salt used to deploy the SmartWallet
     */
    event Deployed(address indexed addr, uint256 salt);

    /**
     * @notice Deploys a new SmartWallet for a user
     * @param owner The address of the owner of the SmartWallet
     */
    function createUserSmartWallet(address owner) external;

    /**
     * @notice Returns the calculated address of a SmartWallet for a user EOA without deploying it
     * @param owner The address of the owner EOA of the SmartWallet
     * @return smartWalletAddress The address of the SmartWallet of the owner
     */
    function getSmartWalletAddress(address owner)
        external
        view
        returns (address);

    /**
     * @notice Returns the SmartWallet for a user, if it has not been deployed deploys it first
     * and then returns the SmartWallet
     * @param owner The address of the owner of the SmartWallet
     * @return smartWallet The SmartWallet of the owner
     */
    function getSmartWallet(address owner) external returns (SmartWallet);
}
