// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @notice Handles all fee distribution accross the RIF Gateway
 *         Beneficiaries may consult/withdraw their funds using this contract
 */
interface IFeeManager {
    /**
     * @notice Emitted when `payee` withdraws from the RIF Gateway
     * @param payee withdrawer
     * @param amount funds to be withdrawn
     */
    event Withdraw(address indexed payee, uint256 indexed amount);

    /**
     * @notice Emitted when `serviceProvider` service is consumed
     * @param serviceProvider service provider address
     * @param fee service provider debt per service consumption
     */
    event ServiceConsumed(address serviceProvider, uint256 fee);

    /**
     * @notice Emitted when `serviceProvider` service is consumed
     * @param serviceProvider service provider address
     * @param fee service provider debt payed
     */
    event DebtPayed(address serviceProvider, uint256 fee);

    /**
     * @notice Emitted when `payee` deposits to the RIF Gateway
     * @param payer account that deposits
     * @param amount funds to be deposited
     */
    event Deposit(address indexed payer, uint256 indexed amount);

    error InvalidAmount();

    error InvalidFee();

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
     * @notice Returns the debt amount
     *
     * @param debtor the address of debtor
     * @return fees
     */
    function getDebtBalance(address debtor) external view returns (uint256);

    /**
     * @notice Allow benificiaries to withdraw their funds
     *
     * @param amount fees to be withdrawn
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Charges a fixed amount to a debtor
     */
    function chargeFee(address debtor) external;
}
