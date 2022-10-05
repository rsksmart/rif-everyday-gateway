// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
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

abstract contract Service is Ownable, IService {
    ServiceType public serviceType;
    mapping(uint256 => ServiceListing) public listings;

    uint256 private _listingCounter;

    error InvalidAmount(uint256 amount);

    function getBalance(address currency) public view virtual returns (uint256);

    function addListing(ServiceListing memory listing)
        public
        override
        onlyOwner
        returns (uint256)
    {
        //todo: check mandatory values.
        uint256 listingId = _listingCounter++;
        listing.id = listingId;
        listings[listingId] = listing;

        emit ListingCreated(listing.currency, listingId);

        return listingId;
    }

    function disableListing(uint256 listingId) public override onlyOwner {
        listings[listingId].enabled = false;
    }

    function getListing(uint256 listingId)
        public
        view
        override
        returns (ServiceListing memory)
    {
        return listings[listingId];
    }

    function getListingsCount() public view override returns (uint256) {
        return _listingCounter;
    }

    function updateListing(ServiceListing memory listing)
        public
        override
        onlyOwner
    {
        listings[listing.id] = listing;
    }
}

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
}

interface ILendingService {
    function lend() external payable;

    function withdraw() external;
}
