// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ACME
 * @dev ACME is a mocked service provider for lending
 * and borrowing services for testing purposes.
 * Inspired on Compound protocol
 * @author RIF protocols team
 */
contract ACME is Ownable {
    error InvalidAmount(uint256 amount);
    error NotEnoughBalance(uint256 amount);
    error NotEnoughCollateral(uint256 balance);
    error NotEnoughDocBalance(uint256 docBalance);
    error PaymentBiggerThanDebt(uint256 debt);
    error TransferFailed(
        address from,
        address to,
        uint256 amount,
        address currency
    );

    struct Balance {
        uint256 amount;
        uint256 blockHeight;
        bool locked;
    }

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed from, uint256 amount);
    event Loan(address indexed from, uint256 amount, address indexed currency);
    event Repay(address indexed from, uint256 amount, address indexed currency);
    event ReceivedLiquidity(uint256 amount);

    mapping(address => mapping(address => Balance)) private _balances;
    mapping(address => mapping(address => Balance)) private _debts;
    uint256 private _subsidy = 0;
    uint256 private _interestPer100Blocks = 10;

    uint256 private _rbtcPrice = 20000e18;

    mapping(address => uint256) private _collateralFactors;

    /**
     * @notice allows ACME owner to update currencies collateral factors
     * @param currency the currency address
     * @param factor the new collateral factor for the currency
     */
    function updateCollateralFactor(address currency, uint256 factor)
        external
        onlyOwner
    {
        if (factor == 0) revert InvalidAmount(factor);
        _collateralFactors[currency] = factor;
    }

    receive() external payable {
        emit ReceivedLiquidity(msg.value);
    }

    /**
     * @notice Deposits the msg.value from msg.sender to the ACME protocol
     */
    function deposit() external payable {
        _deposit(msg.value, msg.sender);
    }

    /**
     * @notice Deposits the msg.value from the depositor to the ACME protocol
     * @param depositor the address of the depositor
     */
    function deposit(address depositor) external payable {
        _deposit(msg.value, depositor);
    }

    /**
     * @notice Deposits RBTC from the depositor to the ACME protocol
     * @param amount the amount of funds to deposit
     * @param depositor the address of the depositor
     */
    function _deposit(uint256 amount, address depositor) internal {
        if (amount == 0) {
            revert InvalidAmount(amount);
        }

        _balances[depositor][address(0)].amount += amount;

        if (_balances[depositor][address(0)].blockHeight == 0) {
            _balances[depositor][address(0)].blockHeight = block.number;
        }

        emit Deposit(depositor, amount);
    }

    /**
     * @notice Allows the msg.sender to withdraw the deposit plus interest
     * @param amount The amount of RBTC to withdraw
     */
    function withdraw(uint256 amount) external {
        _withdraw(amount, msg.sender);
    }

    /**
     * @notice Allows the withdrawer to withdraw the deposit plus interest
     * @param amount The amount of RBTC to withdraw
     * @param withdrawer The address that will receive the RBTC
     */
    function withdraw(uint256 amount, address withdrawer) external {
        _withdraw(amount, withdrawer);
    }

    /**
     * @notice Allows the withdrawer to withdraw the deposit plus interest
     * @param amount The amount of RBTC to withdraw
     * @param withdrawer The address that will receive the RBTC
     */
    function _withdraw(uint256 amount, address withdrawer) internal {
        require(
            !_balances[withdrawer][address(0)].locked,
            "balance is collateral"
        );
        if (
            _balances[withdrawer][address(0)].amount == 0 ||
            amount > _balances[withdrawer][address(0)].amount
        ) {
            revert NotEnoughBalance(amount);
        }

        uint256 interest = _calculateInterest(withdrawer, address(0));

        _balances[withdrawer][address(0)].amount -= amount;

        if (_balances[withdrawer][address(0)].amount == 0) {
            delete _balances[withdrawer][address(0)];
        }

        uint256 total = amount + interest;

        (bool sent, ) = payable(withdrawer).call{value: total}("");
        require(sent, "failed to send value");

        emit Withdraw(withdrawer, total);
    }

    /**
     * @notice Allows the loaner to borrow a certain amount of tokens
     * @param currency The address of the token to borrow
     * @param amount The amount of tokens to borrow
     * @param loaner The address that will receive the tokens
     */
    function loan(
        address currency,
        uint256 amount,
        address loaner
    ) external {
        _loan(currency, amount, loaner);
    }

    /**
     * @notice Allows the msg.sender to borrow a certain amount of tokens
     * @param currency The address of the token to borrow
     * @param amount The amount of tokens to borrow
     */
    function loan(address currency, uint256 amount) external {
        _loan(currency, amount, msg.sender);
    }

    /**
     * @notice Allows the loaner to borrow a certain amount of tokens
     * @param currency The address of the token to borrow
     * @param amount The amount of tokens to borrow
     * @param loaner The address that will receive the tokens
     */
    function _loan(
        address currency,
        uint256 amount,
        address loaner
    ) internal {
        uint256 collateralFactor = _collateralFactors[currency];
        uint256 balance = _balances[loaner][address(0)].amount;
        uint256 balanceUSD = (balance * _rbtcPrice);
        uint256 collateralBalance = ((balanceUSD * collateralFactor) / 1e18) /
            1e18;

        if (collateralBalance < amount) revert NotEnoughCollateral(balance);
        uint256 docBalance = ERC20(currency).balanceOf(address(this));
        if (ERC20(currency).balanceOf(address(this)) < amount)
            revert NotEnoughDocBalance(docBalance);

        _balances[loaner][address(0)].locked = true;
        _debts[loaner][currency] = Balance({
            amount: amount,
            blockHeight: block.number,
            locked: false
        });

        bool success = ERC20(currency).transfer(loaner, amount);
        if (!success)
            revert TransferFailed(address(this), loaner, amount, currency);

        emit Loan(loaner, amount, currency);
    }

    /**
     * @notice Allows the msg.sender to repay the debt of the loaner plus interest
     * @param currency The currency of the loan
     * @param amount The amount of currency to repay
     * @param loaner The address of the debt creditor
     */
    function repay(
        address currency,
        uint256 amount,
        address loaner
    ) external {
        _repay(currency, amount, msg.sender, loaner);
    }

    /**
     * @notice Allows the payer to repay the debt of the loaner plus interest
     * @param currency The currency of the loan
     * @param amount The amount of currency to repay
     * @param payer The address that will pay the debt of the loaner the currency
     * @param loaner The address of the debt creditor
     */
    function repay(
        address currency,
        uint256 amount,
        address payer,
        address loaner
    ) external {
        _repay(currency, amount, payer, loaner);
    }

    /**
     * @notice Allows the payer to repay the debt of the loaner plus interest
     * @param currency The currency of the loan
     * @param amount The amount of currency to repay
     * @param payer The address that will pay the debt of the loaner
     * @param loaner The address of the debt creditor
     */
    function _repay(
        address currency,
        uint256 amount,
        address payer,
        address loaner
    ) internal {
        uint256 debt = _debts[loaner][currency].amount;
        if (amount > debt) revert PaymentBiggerThanDebt(debt);

        _debts[loaner][currency].amount -= amount;

        if (_debts[loaner][currency].amount == 0)
            _debts[loaner][currency].locked = false;

        bool success = ERC20(currency).transferFrom(
            payer,
            address(this),
            amount
        );
        if (!success)
            revert TransferFailed(payer, address(this), amount, currency);

        emit Repay(loaner, amount, currency);
    }

    /**
     * @notice Get the balance of a depositor on ETH
     * @param depositor The address of the depositor
     * @return deposited The amount deposited by the user
     * @return interest The interest accrued from the lending
     */
    function getBalance(address depositor)
        external
        view
        returns (uint256 deposited, uint256 interest)
    {
        return _getBalance(depositor);
    }

    /**
     * @notice Get the balance of a msg.sender on ETH
     * @return deposited The amount deposited by the user
     * @return interest The interest accrued from the lending
     */
    function getBalance()
        external
        view
        returns (uint256 deposited, uint256 interest)
    {
        return _getBalance(msg.sender);
    }

    /**
     * @notice Get the balance of a depositor on ETH
     * @param depositor The address of the depositor
     * @return deposited The amount deposited by the user
     * @return interest The interest accrued from the lending
     */
    function _getBalance(address depositor)
        internal
        view
        returns (uint256 deposited, uint256 interest)
    {
        return (
            _balances[depositor][address(0)].amount,
            _calculateInterest(depositor, address(0))
        );
    }

    /**
     * @notice Calculates simple interest accrued since last checkpoint
     * @param from address of the user
     * @param currency address of the currency
     * @return interest accrued
     */
    function _calculateInterest(address from, address currency)
        private
        view
        returns (uint256)
    {
        uint256 initialBlockHeight = _balances[from][currency].blockHeight;

        if (initialBlockHeight == 0) {
            return 0;
        }

        uint256 elapsedBlocks = block.number - initialBlockHeight;

        return
            (_balances[from][currency].amount *
                elapsedBlocks *
                _interestPer100Blocks) / (100 * 100);
    }

    /**
     * @notice Returns the collateral factor on a currency
     * @param currency The currency to get the collateral factor
     * @return The collateral factor of the given currency
     */
    function getCetCollateralFactor(address currency)
        external
        view
        returns (uint256)
    {
        return _collateralFactors[currency];
    }

    /**
     * @notice Get the debt balance of the msg.sender on a given currency
     * @param currency The currency of the debt
     * @return The debt balance of the msg.sender on a given currency
     */
    function getDebtBalance(address currency) external view returns (uint256) {
        return _getDebtBalance(currency, msg.sender);
    }

    /**
     * @notice Get the debt balance of a loaner on a given currency
     * @param currency The currency of the debt
     * @param loaner The address of the loaner
     * @return The debt balance of the loaner on a given currency
     */
    function getDebtBalance(address currency, address loaner)
        external
        view
        returns (uint256)
    {
        return _getDebtBalance(currency, loaner);
    }

    /**
     * @notice Get the debt balance of a loaner on a given currency
     * @param currency The currency of the debt
     * @param loaner The address of the loaner
     * @return The debt balance of the loaner on a given currency
     */
    function _getDebtBalance(address currency, address loaner)
        internal
        view
        returns (uint256)
    {
        return _debts[loaner][currency].amount;
    }
}
