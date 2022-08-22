// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Service is Ownable {
    enum ServiceType {
        Lending,
        Borrowing
    }

    ServiceType private _serviceType;
}
