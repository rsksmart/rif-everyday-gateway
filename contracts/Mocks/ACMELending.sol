// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract ACMELending {
    using SafeMath for uint256;

    error InvalidAmount(uint256 amount);
    error NotEnoughBalance(uint256 amount);

    struct Balance {
        uint256 amount;
        uint256 blockHeight;
    }

    event Deposit(address indexed _from, uint256 _amount);
    event Withdraw(address indexed _from, uint256 _amount);
    event ReceivedLiquidity(uint256 _amount);

    mapping(address => mapping(address => Balance)) private _balances;
    uint256 private _subsidy = 0;
    uint256 private _interestPer100Blocks = 10;

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

    function _withdraw(uint256 amount, address withdrawer) internal {
        if (_balances[withdrawer][address(0)].amount == 0) {
            revert NotEnoughBalance(amount);
        }

        (uint256 deposited, uint256 balanceInterest) = _getBalance(withdrawer);
        uint256 totalBalance = deposited + balanceInterest;

        if (amount > totalBalance) {
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
            _balances[from][currency]
                .amount
                .mul(elapsedBlocks)
                .mul(_interestPer100Blocks)
                .div(100 * 100);
    }
}
