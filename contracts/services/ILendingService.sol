// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IService.sol";
import "../smartwallet/IForwarder.sol";

interface ILendingService {
    event Lend(
        uint256 indexed listingId,
        address indexed lender,
        address indexed currency,
        uint256 amount
    );

    function lend(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 listingId
    ) external payable;

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) external payable;
}
