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
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        address wallet
    ) external payable;

    function withdraw(IForwarder.MetaTransaction calldata mtx) external payable;
}
