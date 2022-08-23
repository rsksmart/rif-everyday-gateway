// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

contract MockTimeOracle {
    uint256 private _timeStamp;

    function setTimeStamp(uint256 timestamp) public {
        _timeStamp = timestamp;
    }

    function getTimestamp() public view returns (uint256) {
        return _timeStamp;
    }
}
