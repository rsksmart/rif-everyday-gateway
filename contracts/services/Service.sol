// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IService.sol";
import "../core/ISubscriptionReporter.sol";
import {ServiceListing} from "./ServiceData.sol";

abstract contract Service is Ownable, IService {
    bytes4 public serviceType;
    string public serviceProviderName;
    mapping(uint256 => ServiceListing) public listings;

    uint256 private _listingCounter;

    error InvalidAmount(uint256 amount);
    error FailedOperation(bytes data);
    error ListingDisabled(uint256 listingId);

    address private _rifGateway;

    constructor(address rifGateway) {
        _rifGateway = rifGateway;
    }

    modifier withSubscription(address subscriber, uint256 listingId) {
        ISubscriptionReporter(_rifGateway).subscribe(
            subscriber,
            address(this),
            listingId
        );
        _;
    }

    function addListing(ServiceListing memory listing)
        public
        override
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
        virtual
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

    function getThisAddress() public view returns (address) {
        return address(this);
    }

    function currentLiquidity(uint256 index)
        public
        view
        virtual
        returns (uint256 liquidity)
    {
        return listings[index].maxAmount;
    }

    function addLiquidity(uint256 amount, uint256 index)
        public
        virtual
        onlyOwner
    {
        listings[index].maxAmount += amount;
    }

    function removeLiquidity(uint256 amount, uint256 index)
        public
        virtual
        onlyOwner
    {
        _removeLiquidityInternal(amount, index);
    }

    function _removeLiquidityInternal(uint256 amount, uint256 index) internal {
        listings[index].maxAmount -= amount;
    }
}
