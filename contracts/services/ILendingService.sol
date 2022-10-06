// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface ILendingService {
    function lend() external payable;

    function withdraw() external;
}
