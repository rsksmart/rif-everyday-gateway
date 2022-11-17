// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../services/Service.sol";
import "../services/IBorrowService.sol";
import "../smartwallet/IForwarder.sol";

abstract contract BorrowService is Service, IBorrowService {
    constructor(string memory providerName) {
        serviceType = type(IBorrowService).interfaceId; //borrowing/loan
        serviceProviderName = providerName;
    }

    function borrow(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 duration,
        uint256 listingId
    ) public payable virtual;

    function pay(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig,
        uint256 amount,
        uint256 listingId
    ) public payable virtual;

    function withdraw(
        bytes32 suffixData,
        IForwarder.ForwardRequest memory req,
        bytes calldata sig
    ) public payable virtual;

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
