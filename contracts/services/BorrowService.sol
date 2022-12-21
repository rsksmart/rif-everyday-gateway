// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../services/Service.sol";
import "../services/IBorrowService.sol";
import "../smartwallet/IForwarder.sol";

abstract contract BorrowService is Service, IBorrowService {
    constructor(address gateway, string memory providerName) Service(gateway) {
        serviceType = type(IBorrowService).interfaceId; //borrowing/loan
        serviceProviderName = providerName;
    }

    function borrow(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 duration,
        uint256 listingId,
        address wallet
    ) public payable virtual;

    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) public payable virtual;

    function withdraw(IForwarder.MetaTransaction calldata mtx, address currency)
        public
        payable
        virtual;

    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        virtual
        returns (uint256);

    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }
}
