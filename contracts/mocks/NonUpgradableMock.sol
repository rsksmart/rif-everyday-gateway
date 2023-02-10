// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

contract NonUpgradableMock {
    function healthCheck() external pure returns (string memory) {
        return "NonUpgradableMock";
    }
}
