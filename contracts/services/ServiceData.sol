// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

enum PayBackOption {
    day,
    week,
    month,
    year
}

struct ServiceListing {
    uint256 id;
    uint256 minAmount;
    uint256 maxAmount;
    uint256 minDuration;
    uint256 maxDuration;
    uint256 interestRate;
    address collateralCurrency;
    address currency;
    PayBackOption payBackOption;
    bool enabled;
    string name;
    address owner;
}

struct Provider {
    address provider;
    bool validated;
}
