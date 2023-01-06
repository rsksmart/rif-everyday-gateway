// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {ServiceListing} from "./ServiceData.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";

/**
 * @title Service Interface
 * @dev Interface for the Service Interface contract
 * @author RIF protocols team
 */
interface IService is IERC165 {
    /**
     * @notice Emitted when a new service is created
     * @param currency The currency of the listing
     * @param listingId The id of the listing
     */
    event ListingCreated(address indexed currency, uint256 indexed listingId);

    /**
     * @notice Emitted when funds get withdrawn from the service
     * @param listingId The id of the listing
     * @param withdrawer The address of the withdrawer
     * @param currency The currency of the listing
     * @param amount The amount of funds withdrawn
     */
    event Withdraw(
        uint256 indexed listingId,
        address indexed withdrawer,
        address indexed currency,
        uint256 amount
    );

    /**
     * @notice Throws when the amount sent is invalid
     * @param amount The amount sent
     */
    error InvalidAmount(uint256 amount);
    /**
     * @notice Throws when execution fails
     * @param data The detail of the failure
     */
    error FailedOperation(bytes data);
    /**
     * @notice Throws when the listing is not enabled
     * @param listingId The id of the listing
     */
    error ListingDisabled(uint256 listingId);

    /**
     * @notice Add a listing to the service
     * @param listing The listing to be added
     * @return listingId The id of the listing
     */
    function addListing(ServiceListing memory listing)
    external
    returns (uint256);

    /**
     * @notice Disables a listing
     * @param listingId The id of the listing to be disabled
     */
    function disableListing(uint256 listingId) external;

    /**
     * @notice Returns the listing for the given id
     * @param listingId The id of the listing
     * @return listing The listing
     */
    function getListing(uint256 listingId)
    external
    view
    returns (ServiceListing memory);

    /**
     * @notice Returns the number of listings
     * @return count The number of listings
     */
    function getListingsCount() external view returns (uint256);

    /**
     * @notice Allows service owner to update a giving listing
     * @param listing The listing to be updated
     */
    function updateListing(ServiceListing memory listing) external;

    /**
     * @notice Returns balance on a given currency for the user on the service
     * @param currency The currency to check the balance
     */
    function getBalance(address currency) external view returns (uint256);

    /**
     * @notice Returns current liquidity of a given listing
     * @param listingId The id of the listing
     * @return liquidity The liquidity of the listing
     */
    function currentLiquidity(uint256 listingId)
    external
    view
    returns (uint256 liquidity);

    /**
     * @notice Allows service owner to add liquidity to a given listing id
     * @param amount The amount of funds to add
     * @param listingId The id of the listing
     */
    function addLiquidity(uint256 amount, uint256 listingId) external;

    /**
     * @notice Allows service owner to remove liquidity from a given listing id
     * @param amount The amount of funds to remove
     * @param listingId The id of the listing
     */
    function removeLiquidity(uint256 amount, uint256 listingId) external;

    /**
     * @notice Returns the service provider name
     * @return name The service provider name
     */
    function serviceProviderName() external view returns (string memory);

    /**
     * @notice Returns the service type
     * @return serviceType The service type
     */
    function serviceType() external view returns (bytes4);
}
