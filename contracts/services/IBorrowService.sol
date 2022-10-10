// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IBorrowService {
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
