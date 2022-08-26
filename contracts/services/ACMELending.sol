// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract ACMELending {
    using SafeMath for uint256;

    struct Balance {
        uint256 amount;
        uint256 blockHeight;
    }

    event Deposit(address indexed _from, uint256 _amount);
    event Withdraw(address indexed _from, uint256 _amount);

    mapping(address => mapping(address => Balance)) private _balances;
    uint256 private _subsidy = 0;
    uint256 private _interestPer100Blocks = 10;

    function deposit(address currency, uint256 amount) public payable {
        require(msg.value > 0 || amount > 0, "No tokens sent");

        Balance storage _balance = _balances[msg.sender][currency];

        if (currency == address(0)) {
            _balance.amount += msg.value;
        } else {
            IERC20(currency).transferFrom(msg.sender, address(this), amount);
            _balance.amount += amount;
        }

        if (_balance.blockHeight == 0) {
            _balance.blockHeight = block.number;
        }

        emit Deposit(msg.sender, amount);
    }

    function withdraw(address currency, uint256 amount) public {
        require(
            _balances[msg.sender][currency].amount > 0,
            "Not enough balance"
        );

        if (currency == address(0)) {
            _balances[msg.sender][address(0)].amount -= amount;
            payable(msg.sender).transfer(amount);
        } else {
            _balances[msg.sender][currency].amount -= amount;
            IERC20(currency).transferFrom(address(this), msg.sender, amount);
        }

        if (_balances[msg.sender][currency].amount == 0) {
            delete _balances[msg.sender][currency];
        }
    }

    function getBalance(address currency) public view returns (uint256) {
        return
            _balances[msg.sender][currency].amount +
            _calculateInterest(msg.sender, currency);
    }

    function _calculateInterest(address from, address currency)
        private
        view
        returns (uint256)
    {
        uint256 initialBlockHeight = _balances[from][currency].blockHeight;

        require(initialBlockHeight > 0, "Balance not found");

        uint256 elapsedBlocks = initialBlockHeight - block.number;

        require(elapsedBlocks > 100, "Must wait for 100 blocks");

        return elapsedBlocks.div(100).mul(_interestPer100Blocks.div(100));
    }
}
