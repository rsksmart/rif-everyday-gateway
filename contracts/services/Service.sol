// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IService.sol";
import "../gateway/ISubscriptionReporter.sol";
import {ServiceListing} from "./ServiceData.sol";

/**
 * @title Service
 * @dev Contract for the Service contract
 * @author RIF protocols team
 */
abstract contract Service is Ownable, IService {
    bytes4 public serviceType;
    string public serviceProviderName;
    mapping(uint256 => ServiceListing) public listings;

    uint256 private _listingCounter;
    address private _rifGateway;

    constructor(address rifGateway) {
        _rifGateway = rifGateway;
    }

    /**
     * @notice Used to keep track service consumption
     * @dev Calls subscribe function from SubscriptionReporter
     * that updates subscription array and charges fees on the FeeManager
     * @param subscriber The address of the subscriber
     * @param listingId The id of the listing
     * @param wallet The address of the wallet
     */
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

    /**
     * @inheritdoc IService
     */
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

    /**
     * @inheritdoc IService
     */
    function disableListing(uint256 listingId) public override onlyOwner {
        listings[listingId].enabled = false;
    }

    /**
     * @inheritdoc IService
     */
    function getListing(uint256 listingId)
        public
        view
        virtual
        returns (ServiceListing memory)
    {
        return listings[listingId];
    }

    /**
     * @inheritdoc IService
     */
    function getListingsCount() public view override returns (uint256) {
        return _listingCounter;
    }

    /**
     * @inheritdoc IService
     */
    function updateListing(ServiceListing memory listing)
        public
        override
        onlyOwner
    {
        listings[listing.id] = listing;
    }

    /**
     * @inheritdoc IService
     */
    function currentLiquidity(uint256 listingId)
        public
        view
        virtual
        returns (uint256 liquidity)
    {
        return listings[listingId].maxAmount;
    }

    /**
     * @inheritdoc IService
     */
    function addLiquidity(uint256 amount, uint256 listingId)
        public
        virtual
        onlyOwner
    {
        _addLiquidityInternal(amount, listingId);
    }

    /**
     * @notice Adds the given amount of liquidity from a given listing id
     * @dev Allows this contract to add liquidity on internal calls
     * @param amount The amount of liquidity to be added
     * @param listingId The id of the listing from where to add liquidity
     */
    function _addLiquidityInternal(uint256 amount, uint256 listingId) internal {
        listings[listingId].maxAmount += amount;
    }

    /**
     * @inheritdoc IService
     */
    function removeLiquidity(uint256 amount, uint256 listingId)
        public
        virtual
        onlyOwner
    {
        _removeLiquidityInternal(amount, listingId);
    }

    /**
     * @notice Removes the given amount of liquidity from a given listing id
     * @dev Allows this contract to remove liquidity on internal calls
     * @param amount The amount of liquidity to be removed
     * @param listingId The id of the listing from where to remove liquidity
     */
    function _removeLiquidityInternal(uint256 amount, uint256 listingId)
        internal
    {
        listings[listingId].maxAmount -= amount;
    }
}
