// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

contract NonUpgradableMock {
    function healthCheck() external pure returns (string memory) {
        return "NonUpgradableMock";
    }
}
