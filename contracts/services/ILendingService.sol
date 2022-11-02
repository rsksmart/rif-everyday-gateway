// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";
import "../smartwallet/IForwarder.sol";

interface ILendingService is IService {
    function lend(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) external payable;

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) external payable;
}
