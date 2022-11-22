// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";
import "../smartwallet/IForwarder.sol";

interface IBorrowService is IService {
    event Borrow(
        uint256 indexed listingId,
        address indexed borrower,
        address indexed currency,
        uint256 amount,
        uint256 duration
    );

    event Pay(
        uint256 indexed listingId,
        address indexed borrower,
        address indexed currency,
        uint256 amount
    );

    function borrow(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 duration,
        uint256 listingId
    ) external payable;

    function pay(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 listingId
    ) external payable;

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        address currency
    ) external payable;

    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        returns (uint256);

    function getCollateralBalance() external view returns (uint256);
}
