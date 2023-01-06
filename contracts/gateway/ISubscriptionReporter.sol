// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface ISubscriptionReporter {
    struct Subscription {
        address service;
        uint256 listingId;
    }

    event NewSubscription(address subscriber, address service);

    function subscribe(
        address subscriber,
        address service,
        uint256 listingId,
        address wallet
    ) external;

    function getSubscriptions(address subscriber)
        external
        view
        returns (Subscription[] memory);
}
