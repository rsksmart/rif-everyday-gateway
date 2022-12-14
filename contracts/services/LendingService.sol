// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Service.sol";
import "./ILendingService.sol";
import "../smartwallet/IForwarder.sol";

abstract contract LendingService is Service, ILendingService {
    constructor(address gateway, string memory providerName) Service(gateway) {
        serviceType = type(ILendingService).interfaceId; //lending/savings
        serviceProviderName = providerName;
    }

    function lend(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        address wallet
    ) public payable virtual;

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }

    function withdraw(IForwarder.MetaTransaction calldata mtx)
        public
        payable
        virtual;
}
