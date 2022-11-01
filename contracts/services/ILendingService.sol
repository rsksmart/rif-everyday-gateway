// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";

interface ILendingService is IService {
    event Lend(
        uint256 indexed listingId,
        address indexed lender,
        address indexed currency,
        uint256 amount
    );

    function lend() external payable;

    function withdraw() external;
}
