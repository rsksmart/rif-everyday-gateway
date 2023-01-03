// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IService.sol";
import "../gateway/ISubscriptionReporter.sol";
import {ServiceListing} from "./ServiceData.sol";

abstract contract Service is Ownable, IService {
    bytes4 public serviceType;
    string public serviceProviderName;
    mapping(uint256 => ServiceListing) public listings;

    uint256 private _listingCounter;
    address private _rifGateway;

    error InvalidAmount(uint256 amount);
    error FailedOperation(bytes data);
    error ListingDisabled(uint256 listingId);

    constructor(address rifGateway) {
        _rifGateway = rifGateway;
    }

    modifier withSubscription(
        address subscriber,
        uint256 listingId,
        address wallet
    ) {
        ISubscriptionReporter(_rifGateway).subscribe(
            subscriber,
            address(this),
            listingId,
            wallet
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

    function currentLiquidity(uint256 listingId)
        public
        view
        virtual
        returns (uint256 liquidity)
    {
        return listings[listingId].maxAmount;
    }

    function addLiquidity(uint256 amount, uint256 listingId)
        public
        virtual
        onlyOwner
    {
        _addLiquidityInternal(amount, listingId);
    }

    function _addLiquidityInternal(uint256 amount, uint256 listingId) internal {
        listings[listingId].maxAmount += amount;
    }

    function removeLiquidity(uint256 amount, uint256 listingId)
        public
        virtual
        onlyOwner
    {
        _removeLiquidityInternal(amount, listingId);
    }

    function _removeLiquidityInternal(uint256 amount, uint256 listingId)
        internal
    {
        listings[listingId].maxAmount -= amount;
    }
}
