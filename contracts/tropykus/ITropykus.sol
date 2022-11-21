// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

interface IPriceOracleProxy {
    function getUnderlyingPrice(address cToken) external view returns (uint256);
}

interface IComptrollerG6 {
    function markets(address cToken) external view returns (bool, uint256);

    function getAllMarkets() external view returns (IcErc20[] memory);
}

interface IcErc20 {
    function symbol() external view returns (string memory);

    function underlying() external view returns (address);

    function borrowRatePerBlock() external view returns (uint256);
}
