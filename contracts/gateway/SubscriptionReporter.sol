// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./ISubscriptionReporter.sol";
import "../feeManager/FeeManager.sol";

/**
 * @title Subscription Reporter
 * @dev Contract for the Subscription Reporter contract
 * @author RIF protocols team
 */
abstract contract SubscriptionReporter is ISubscriptionReporter {
    mapping(address => Subscription[]) public subscriptions;
    IFeeManager public feeManager;

    constructor() {
        feeManager = new FeeManager(msg.sender);
    }

    /**
     * @inheritdoc ISubscriptionReporter
     */
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

    /**
     * @inheritdoc ISubscriptionReporter
     */
    function getSubscriptions(address subscriber)
        external
        view
        override
        returns (Subscription[] memory)
    {
        return subscriptions[subscriber];
    }
}
