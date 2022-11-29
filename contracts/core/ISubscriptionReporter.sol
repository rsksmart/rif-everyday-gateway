// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface ISubscriptionReporter {
    event NewSubscribtion(address subscriber, address service);

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