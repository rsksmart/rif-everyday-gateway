// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

contract RIFGateway {
    function foo() external pure returns (string memory) {
        return "bar";
    }

    function _bar() internal pure returns (string memory) {
        return "baz";
    }
}
