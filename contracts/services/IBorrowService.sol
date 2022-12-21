// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";
import "../smartwallet/IForwarder.sol";

interface IBorrowService {
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
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 duration,
        uint256 listingId,
        address wallet
    ) external payable;

    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) external payable;

    function withdraw(IForwarder.MetaTransaction calldata mtx, address currency)
        external
        payable;

    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        returns (uint256);

    function getCollateralBalance() external view returns (uint256);
}
