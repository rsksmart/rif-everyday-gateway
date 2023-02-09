// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../feeManager/IFeeManager.sol";

/**
 * @title Subscription Reporter Interface
 * @dev Interface for the Subscription Reporter contract
 * @author RIF protocols team
 */
interface ISubscriptionReporter {
    struct Subscription {
        address service;
        uint256 listingId;
    }

    /**
     * @notice Emitted when a new subscription is created
     * @param subscriber The address of the subscriber
     * @param service The address of the service
     */
    event NewSubscription(address subscriber, address service);

    /**
     * @notice Subscribes to a service consumption
     * @param subscriber The address of the subscriber
     * @param service The address of the service
     * @param listingId The id of the listing
     * @param wallet The address of the wallet
     */
    function subscribe(
        address subscriber,
        address service,
        uint256 listingId,
        address wallet
    ) external;

    /**
     * @notice Returns all subscriptions from a given subscriber
     * @param subscriber The address of the subscriber
     */
    function getSubscriptions(address subscriber)
        external
        view
        returns (Subscription[] memory);

    /**
     * @notice Returns FeeManager address for charging fees
     * @return feeManager address set
     */
    function feeManager() external view returns (IFeeManager);
}
