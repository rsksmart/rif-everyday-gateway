// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import { ServiceListing} from "./ServiceData.sol";
import "./ERC165.sol";

interface IService is ERC165 {
    event ListingCreated(address indexed currency, uint256 indexed listingId);

    event Withdraw(
        uint256 indexed listingId,
        address indexed withdrawer,
        address indexed currency,
        uint256 amount
    );

    function addListing(ServiceListing memory listing)
        external
        returns (uint256);

    function disableListing(uint256 listingId) external;

    function getListing(uint256 listingId)
        external
        view
        returns (ServiceListing memory);

    function getListingsCount() external view returns (uint256);

    function updateListing(ServiceListing memory listing) external;

    function getBalance(address currency) external view returns (uint256);

    function getServiceType() external view returns (bytes4);

    function getServiceProviderName() external view returns (string memory);
}
