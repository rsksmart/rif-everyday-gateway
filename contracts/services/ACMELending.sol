// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract ACMELending {
    using SafeMath for uint256;

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
        require(msg.value > 0, "No amount sent");

        _balances[msg.sender][address(0)].amount += msg.value;

        if (_balances[msg.sender][address(0)].blockHeight == 0) {
            _balances[msg.sender][address(0)].blockHeight = block.number;
        }

        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(
            _balances[msg.sender][address(0)].amount > 0 &&
                _balances[msg.sender][address(0)].amount >= amount,
            "Not enough balance"
        );

        uint256 interest = _calculateInterest(msg.sender, address(0));

        _balances[msg.sender][address(0)].amount -= amount;

        if (_balances[msg.sender][address(0)].amount == 0) {
            delete _balances[msg.sender][address(0)];
        }

        uint256 total = amount + interest;

        payable(msg.sender).transfer(total);

        emit Withdraw(msg.sender, total);
    }

    function getBalance()
        external
        view
        returns (uint256 deposited, uint256 interest)
    {
        return (
            _balances[msg.sender][address(0)].amount,
            _calculateInterest(msg.sender, address(0))
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
