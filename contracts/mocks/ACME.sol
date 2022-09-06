// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ACME is Ownable {
    error InvalidAmount(uint256 amount);
    error NotEnoughBalance(uint256 amount);
    error NotEnoughCollateral(uint256 balance);
    error NotEnoughDocBalance(uint256 docBalance);
    error PaymentBiggerThanDebt(uint256 debt);

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

    function deposit() external payable {
        _deposit(msg.value, msg.sender);
    }

    function deposit(address depositor) external payable {
        _deposit(msg.value, depositor);
    }

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

    function withdraw(uint256 amount) external {
        _withdraw(amount, msg.sender);
    }

    function withdraw(uint256 amount, address withdrawer) external {
        _withdraw(amount, withdrawer);
    }

    function loan(
        address currency,
        uint256 amount,
        address loaner
    ) external {
        _loan(currency, amount, loaner);
    }

    function loan(address currency, uint256 amount) external {
        _loan(currency, amount, msg.sender);
    }

    function _loan(
        address currency,
        uint256 amount,
        address loaner
    ) internal {
        uint256 collateralFactor = _collateralFactors[currency];
        uint256 balance = _balances[loaner][address(0)].amount;
        uint256 balanceUSD = (balance * _rbtcPrice) / 1e18;
        uint256 collateralBalance = (balanceUSD * collateralFactor) / 1e18;

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

        ERC20(currency).transfer(loaner, amount);

        emit Loan(loaner, amount, currency);
    }

    function repay(
        address currency,
        uint256 amount,
        address loaner
    ) external {
        _repay(currency, amount, msg.sender, loaner);
    }

    function repay(
        address currency,
        uint256 amount,
        address payer,
        address loaner
    ) external {
        _repay(currency, amount, payer, loaner);
    }

    function _repay(
        address currency,
        uint256 amount,
        address payer,
        address loaner
    ) internal {
        uint256 debt = _debts[loaner][currency].amount;
        if (amount > debt) revert PaymentBiggerThanDebt(debt);

        ERC20(currency).transferFrom(payer, address(this), amount);
        _debts[loaner][currency].amount -= amount;
        if (_debts[loaner][currency].amount == 0)
            _debts[loaner][currency].locked = false;

        emit Repay(loaner, amount, currency);
    }

    function _withdraw(uint256 amount, address withdrawer) internal {
        require(
            !_balances[withdrawer][address(0)].locked,
            "balance compromised as collateral"
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

        payable(withdrawer).transfer(total);

        emit Withdraw(withdrawer, total);
    }

    function getBalance(address depositor)
        external
        view
        returns (uint256 deposited, uint256 interest)
    {
        return _getBalance(depositor);
    }

    function getBalance()
        external
        view
        returns (uint256 deposited, uint256 interest)
    {
        return _getBalance(msg.sender);
    }

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

    function getCetCollateralFactor(address currency)
        external
        view
        returns (uint256)
    {
        return _collateralFactors[currency];
    }
}
