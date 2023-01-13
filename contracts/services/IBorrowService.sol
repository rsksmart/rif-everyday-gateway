// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "./IService.sol";
import "../smartwallet/IForwarder.sol";

/**
 * @title Borrow Service Interface
 * @dev Interface for the Borrow Service contract
 * @author RIF protocols team
 */
interface IBorrowService {
    /**
     * @notice Emitted when a new borrow service is consumed
     * @param listingId The id of the listing
     * @param borrower The address of the borrower
     * @param currency The address of the currency
     * @param amount The amount of the loan
     * @param duration The duration of the loan
     */
    event Borrow(
        uint256 indexed listingId,
        address indexed borrower,
        address indexed currency,
        uint256 amount,
        uint256 duration
    );

    /**
     * @notice Emitted when a borrow service is repaid
     * @param listingId The id of the listing
     * @param borrower The address of the borrower
     * @param currency The address of the currency
     * @param amount The amount of the loan
     */
    event Pay(
        uint256 indexed listingId,
        address indexed borrower,
        address indexed currency,
        uint256 amount
    );

    /**
     * @notice Borrows funds to a user from a service listing
     * @param mtx The meta transaction { bytes32 suffixData, ForwardRequest req { address from, uint256 nonce, address executor }, bytes sig }
     * @param amount The amount of the loan
     * @param duration The duration of the loan
     * @param listingId The id of the listing
     * @param wallet The address of the borrower
     */
    function borrow(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 duration,
        uint256 listingId,
        address wallet
    ) external payable;

    /**
     * @notice Repays a loan
     * @param mtx The meta transaction { bytes32 suffixData, ForwardRequest req { address from, uint256 nonce, address executor }, bytes sig }
     * @param amount The amount of the loan
     * @param listingId The id of the listing
     */
    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) external payable;

    /**
     * @notice Withdraws funds from the service listing
     * @param mtx The meta transaction { bytes32 suffixData, ForwardRequest req { address from, uint256 nonce, address executor }, bytes sig }
     * @param currency The address of the currency from the funds will be withdrawn
     */
    function withdraw(IForwarder.MetaTransaction calldata mtx, address currency)
        external
        payable;

    /**
     * @notice Gets the amount of required collateral
     * @param amount The amount of the loan
     * @param currency The address of the currency of the loan
     * @return The amount of required collateral
     */
    function calculateRequiredCollateral(uint256 amount, address currency)
        external
        view
        returns (uint256);

    /**
     * @notice Gets the balance of the currency as collateral
     * @return The balance of the currency add as collateral
     */
    function getCollateralBalance() external view returns (uint256);
}
