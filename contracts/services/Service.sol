// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IService.sol";
import {ServiceListing} from "./ServiceData.sol";


abstract contract Service is Ownable, IService {
    bytes4 public serviceType;
    string public serviceProviderName;
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

    function getServiceType() external view override returns (bytes4) {
        return serviceType;
    }

    function getServiceProviderName()
        external
        view
        override
        returns (string memory)
    {
        return serviceProviderName;
    }
}
