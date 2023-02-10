// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title IOwnable
 * @notice Interface for the Ownable contract.
 */
interface IOwnable {
    function transferOwnership(address newOwner) external;

    function owner() external view returns (address);
}
