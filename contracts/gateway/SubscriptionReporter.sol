// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./ISubscriptionReporter.sol";
import "../feeManager/FeeManager.sol";

abstract contract SubscriptionReporter is ISubscriptionReporter {
    mapping(address => Subscription[]) public subscriptions;
    IFeeManager public feeManager;

    constructor() {
        feeManager = new FeeManager(msg.sender);
    }

    function subscribe(
        address subscriber,
        address service,
        uint256 listingId,
        address wallet
    ) public virtual {
        subscriptions[subscriber].push(Subscription(service, listingId));
        feeManager.chargeFee(service, wallet);

        emit NewSubscription(subscriber, service);
    }

    function getSubscriptions(address subscriber)
        external
        view
        override
        returns (Subscription[] memory)
    {
        return subscriptions[subscriber];
    }
}
