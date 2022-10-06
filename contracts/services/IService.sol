// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {ServiceType, ServiceListing} from "./ServiceData.sol";

interface IService {
    event ListingCreated(address indexed currency, uint256 indexed listingId);

    event Withdraw(
        uint256 indexed listingId,
        address indexed withdrawer,
        address indexed currency,
        uint256 amount
    );

    event Lend(
        uint256 indexed listingId,
        address indexed lender,
        address indexed currency,
        uint256 amount
    );

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

    function addListing(ServiceListing memory listing)
        external
        returns (uint256);

    function disableListing(uint256 listingId) external;

    function getListing(uint256 listingId)
        external
        view
        returns (ServiceListing memory);

    function getListingsCount() external view returns (uint256);

    function updateListing(ServiceListing memory listing) external;

    function getBalance(address currency) external view returns (uint256);
}
