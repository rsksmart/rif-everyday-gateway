// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @notice Handles all fee distribution accross the RIF Gateway
 *         Beneficiaries may consult/withdraw their funds using this contract
 */
interface IFeeManager {
    error InvalidAmount();

    error InsufficientFunds();

    error RBTCTransferFailed();

    /**
     * @notice
     * Funds the beneficiary with `amount` in fees
     *
     * @param beneficiary the address of beneficiary to be funded
     */
    function fundBeneficiary(address beneficiary) external payable;

    /**
     * @notice Returns the beneficiary fees amount
     *
     * @param beneficiary the address of beneficiary to be funded
     * @return fees
     */
    function getBalance(address beneficiary) external view returns (uint256);

    /**
     * @notice Allow benificiaries to withdraw their funds
     *
     * @param amount fees to be withdrawn
     */
    function withdraw(uint256 amount) external;
}
