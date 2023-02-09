// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IOwnable {
    function transferOwnership(address newOwner) external;

    function owner() external view returns (address);
}
