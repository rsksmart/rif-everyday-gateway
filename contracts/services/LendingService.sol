// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Service.sol";
import "./ILendingService.sol";
import "../smartwallet/IForwarder.sol";

/**
 * @title Lending Service
 * @dev Implementation of the Lending Service interface
 * @author RIF protocols team
 */
abstract contract LendingService is Service, ILendingService {
    /**
     * @dev Sets the values for {serviceType} and {serviceProviderName}.
     */
    constructor(address gateway, string memory providerName) Service(gateway) {
        serviceType = type(ILendingService).interfaceId; //lending/savings
        serviceProviderName = providerName;
    }

    /**
     * @inheritdoc ILendingService
     */
    function lend(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        address wallet
    ) public payable virtual;

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == serviceType ||
            interfaceId == this.supportsInterface.selector;
    }

    /**
     * @inheritdoc ILendingService
     */
    function withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId
    ) public payable virtual;
}
