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
    uint256[10] private __gap;

    function initialize(address feeManagerAddr) public {
        require(address(feeManager) == address(0), "Already initialized");
        feeManager = IFeeManager(feeManagerAddr);
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
        emit NewSubscription(subscriber, service);
        subscriptions[subscriber].push(Subscription(service, listingId));
        feeManager.chargeFee(service, wallet);
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
