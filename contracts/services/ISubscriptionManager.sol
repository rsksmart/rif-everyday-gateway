// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface ISubscriptionManager {
    error ServiceNotFound(address service);

    event Subscribed(address service);
    event SubscriptionUpdated(address service, bool active);

    struct Subscription {
        address service;
        uint256 listingId;
    }

    function subscribe(
        address subscriber,
        address service,
        uint256 listingId
    ) external;
}
