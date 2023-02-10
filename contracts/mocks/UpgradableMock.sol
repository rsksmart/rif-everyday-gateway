// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract UpgradableMock is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {}

    function healthCheck() external pure returns (string memory) {
        return "UpgradableMock";
    }
}
