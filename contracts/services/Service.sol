// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IServiceData.sol";

abstract contract Service is IServiceData, Ownable {
    ServiceType public serviceType;
}
