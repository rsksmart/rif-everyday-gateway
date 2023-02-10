// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract UpgradableMock is UUPSUpgradeable {
    function _authorizeUpgrade(address newImplementation) internal override {}

    function healthCheck() external pure returns (string memory) {
        return "UpgradableMock";
    }
}
