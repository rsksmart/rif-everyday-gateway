// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ACME {
    using SafeMath for uint256;

    error InvalidAmount(uint256 amount);
    error NotEnoughBalance(uint256 amount);

    struct Balance {
        uint256 amount;
        uint256 blockHeight;
        bool locked;
    }

    event Deposit(address indexed _from, uint256 _amount);
    event Withdraw(address indexed _from, uint256 _amount);
    event Loan(address indexed _from, uint256 _amount);
    event Repay(address indexed _from, uint256 _amount);
    event ReceivedLiquidity(uint256 _amount);

    mapping(address => mapping(address => Balance)) private _balances;
    mapping(address => mapping(address => Balance)) private _debts;
    uint256 private _subsidy = 0;
    uint256 private _interestPer100Blocks = 10;

    uint256 private _rbtcPrice = 20000;

    mapping(address => uint256) private _collateralFactors;

    function updateCollateralFactor(address currency, uint256 factor) external {
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
        uint256 collateralBalance = balance * _rbtcPrice * collateralFactor;
        require(collateralBalance >= amount, "not enough collateral");
        require(
            ERC20(currency).balanceOf(address(this)) >= amount,
            "not enough balance"
        );

        ERC20(currency).transfer(loaner, amount);
        _balances[loaner][address(0)].locked = true;
        _debts[loaner][currency] = Balance({
            amount: amount,
            blockHeight: block.number,
            locked: false
        });
    }

    function repay(address currency, uint256 amount) external {
        _repay(currency, amount, msg.sender);
    }

    function repay(
        address currency,
        uint256 amount,
        address payer
    ) external {
        _repay(currency, amount, payer);
    }

    function _repay(
        address currency,
        uint256 amount,
        address payer
    ) internal {
        // TODO
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
}
