// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/* solhint-disable no-empty-blocks */

/**
 * @title UpgradableMock
 * @dev Mock contract for testing upgradeability
 * @author RIF protocols team
 */
contract UpgradableMock is UUPSUpgradeable {
    /**
     * @inheritdoc UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override {}

    /**
     * @dev Mock function for testing upgradeability
     * @return string "UpgradableMock"
     */
    function healthCheck() external pure returns (string memory) {
        return "UpgradableMock";
    }
}
