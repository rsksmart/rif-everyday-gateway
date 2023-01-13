// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../services/Service.sol";
import "../services/IBorrowService.sol";
import "../smartwallet/IForwarder.sol";

/**
 * @title Borrow Service
 * @dev Implementation of the Borrow Service interface
 * @author RIF protocols team
 */
abstract contract BorrowService is Service, IBorrowService {
    /**
     * @dev Sets the values for {serviceType} and {serviceProviderName}.
     */
    constructor(address gateway, string memory providerName) Service(gateway) {
        serviceType = type(IBorrowService).interfaceId; //borrowing/loan
        serviceProviderName = providerName;
    }

    /**
     * @inheritdoc IBorrowService
     */
    function borrow(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 duration,
        uint256 listingId,
        address wallet
    ) public payable virtual;

    /**
     * @inheritdoc IBorrowService
     */
    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) public payable virtual;

    /**
     * @inheritdoc IBorrowService
     */
    function withdraw(IForwarder.MetaTransaction calldata mtx, address currency)
        public
        payable
        virtual;

    /**
     * @inheritdoc IBorrowService
     */
    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        virtual
        returns (uint256);

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }
}
