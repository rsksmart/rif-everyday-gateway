// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IOwnable
 * @notice Interface for the Ownable contract.
 */
interface IOwnable {
    /**
     * @notice Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     * @param newOwner The address of the new owner.
     */
    function transferOwnership(address newOwner) external;

    /**
     * @notice Returns the address of the current owner.
     * @return The address of the current owner.
     */
    function owner() external view returns (address);
}
