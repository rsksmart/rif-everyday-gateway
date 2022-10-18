// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

enum PayBackOption {
    day,
    week,
    month,
    year
}

enum ServiceType {
    Lending,
    Borrowing
}

struct ServiceListing {
    uint256 id;
    uint256 minAmount;
    uint256 maxAmount;
    uint256 minDuration;
    uint256 maxDuration;
    uint256 interestRate;
    uint256 loanToValue;
    address loanToValueTokenAddr;
    address currency;
    PayBackOption payBackOption;
    bool enabled;
    string name;
}
