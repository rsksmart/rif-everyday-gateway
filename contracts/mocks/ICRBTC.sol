// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.4;

interface ICRBTC {
    function mint() external payable;

    function balanceOf(address owner) external view returns (uint256);

    function exchangeRateStored() external view returns (uint256);

    function redeem(uint256 redeemTokens) external returns (uint256);
}
