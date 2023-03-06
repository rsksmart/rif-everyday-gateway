// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @title NonUpgradableMock
 * @dev Mock contract for testing upgradeability
 * @author RIF protocols team
 */
contract NonUpgradableMock {
    /**
     * @dev Mock function for testing upgradeability
     * @return string "NonUpgradableMock"
     */
    function healthCheck() external pure returns (string memory) {
        return "NonUpgradableMock";
    }
}
