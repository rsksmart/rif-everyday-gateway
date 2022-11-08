// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

enum SubscriptionEvent {
    SERVICE_CONSUMPTION
}

struct Subscription {
    ISubscriber subscriber;
    SubscriptionEvent _event;
    // TODO: investigate how to serialiaze data into bytes and viceversa
    // for any data forwarded to the observers based on event triggering
    bytes data;
}

interface ISubscriber {
    function update(address provider) external;
}

abstract contract Publisher {
    Subscription[] internal _subscribers;

    function subscribe(ISubscriber subscriber, SubscriptionEvent _event)
        external
        virtual
    {
        _subscribers.push(Subscription(subscriber, _event, ""));
    }

    function unsubscribe(ISubscriber subscriber, SubscriptionEvent _event)
        external
        virtual
    {
        for (uint256 i = 0; i < _subscribers.length; i++) {
            if (
                _subscribers[i].subscriber == subscriber &&
                _subscribers[i]._event == _event
            ) {
                delete _subscribers[i];
                return;
            }
        }
    }

    function notify(address provider, SubscriptionEvent _event) external {
        for (uint256 i = 0; i < _subscribers.length; i++) {
            if (_event == _subscribers[i]._event) {
                _subscribers[i].subscriber.update(provider);
            }
        }
    }
}
