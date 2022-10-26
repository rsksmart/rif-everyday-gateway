// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/ServiceData.sol";
import "./Service.sol";
import "./ILendingService.sol";

abstract contract LendingService is Service, ILendingService {
    constructor(string memory serviceProviderName) {
        serviceType = type(ILendingService).interfaceId; //lending/savings
        serviceProviderName = serviceProviderName;
    }

    function lend() public payable virtual;

    function withdraw() public virtual;

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }
}
