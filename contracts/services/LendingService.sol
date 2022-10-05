// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/Service.sol";
import "contracts/services/ServiceData.sol";

abstract contract LendingService is Service, ILendingService {
    constructor() {
        serviceType = ServiceType.Lending;
    }

    function lend() public payable virtual;

    function withdraw() public virtual;
}
