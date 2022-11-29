// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./ISubscriptionReporter.sol";
import "../feeManager/IFeeManager.sol";

abstract contract SubscriptionReporter is ISubscriptionReporter {
    mapping(address => Subscription[]) private _subscriptions;
    IFeeManager private _feeManager;

    constructor(IFeeManager feeManager) {
        _feeManager = feeManager;
    }

    function _subscribeInternal(
        address subscriber,
        address service,
        uint256 listingId
    ) internal {
        _subscriptions[subscriber].push(Subscription(service, listingId));
        _feeManager.chargeFee(service);

        emit NewSubscribtion(subscriber, service);
    }
}
