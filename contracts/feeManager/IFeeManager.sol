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
     * @param ownerFee service provider debt per service consumption for the gateway
     * @param wallet wallet address
     * @param walletFee service provider debt per service consumption for the wallet
     */
    event ServiceConsumptionFee(
        address serviceProvider,
        uint256 ownerFee,
        address wallet,
        uint256 walletFee
    );

    /**
     * @notice Emitted when `serviceProvider` service is consumed
     * @param serviceProvider service provider address
     * @param beneficiary account that received the payment
     * @param fee service provider debt paid
     */
    event FeePayment(address serviceProvider, address beneficiary, uint256 fee);

    error InvalidAmount();

    error NoPendingFees();

    error InsufficientFunds();

    error RBTCTransferFailed();

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
     * @notice Returns the debt amount for specific debtor and beneficiary
     *
     * @param debtor the address of debtor
     * @param beneficiary the address of beneficiary
     * @return fees
     */
    function getDebtBalanceFor(address debtor, address beneficiary)
        external
        view
        returns (uint256);

    /**
     * @notice Allow benificiaries to withdraw their funds
     *
     * @param amount fees to be withdrawn
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Charges a fixed amount to a debtor
     *
     * @param debtor the address of debtor
     * @param wallet the address of wallet
     */
    function chargeFee(address debtor, address wallet) external;

    /**
     * @notice Pays the pending fees using `msg.sender` as the debtor
     */
    function pay() external payable;

    /**
     * @notice Pays the pending fees
     *
     * @param debtor the address of debtor
     */
    function payInBehalfOf(address debtor) external payable;
}
