// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";

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
        uint256 amount,
        address currency,
        uint256 duration,
        uint256 listingId
    ) external payable;

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) external payable;

    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        returns (uint256);

    function getCollateralBalance() external view returns (uint256);
}
