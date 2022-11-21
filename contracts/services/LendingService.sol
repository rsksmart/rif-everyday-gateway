// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Service.sol";
import "./ILendingService.sol";
import "../smartwallet/IForwarder.sol";

abstract contract LendingService is Service, ILendingService {
    constructor(string memory providerName) {
        serviceType = type(ILendingService).interfaceId; //lending/savings
        serviceProviderName = providerName;
    }

    function lend(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 listingId
    ) public payable virtual;

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) public payable virtual;
}
