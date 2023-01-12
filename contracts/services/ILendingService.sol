// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IService.sol";
import "../smartwallet/IForwarder.sol";

/**
 * @title Lending Service Interface
 * @dev Interface for the Lending Service contract
 * @author RIF protocols team
 */
interface ILendingService {
    /**
     * @notice Emitted when a new lend service is consumed
     * @param listingId The id of the listing
     * @param lender The address of the lender
     * @param currency The address of the currency
     * @param amount The amount of the loan
     */
    event Lend(
        uint256 indexed listingId,
        address indexed lender,
        address indexed currency,
        uint256 amount
    );

    /**
     * @notice Lends funds to a user from a service listing
     * @param mtx The meta transaction { bytes32 suffixData, ForwardRequest req { address from, uint256 nonce, address executor }, bytes sig }
     * @param amount The amount of the loan
     * @param listingId The id of the listing
     * @param wallet The address of the lender
     */
    function lend(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        address wallet
    ) external payable;

    /**
     * @notice Withdraws funds from the service listing
     * @param mtx The meta transaction { bytes32 suffixData, ForwardRequest req { address from, uint256 nonce, address executor }, bytes sig }
     * @param listingId The id of the listing
     */
    function withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId
    ) external payable;
}
