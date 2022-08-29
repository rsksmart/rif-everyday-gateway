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
        require(msg.value > 0 || amount > 0, "No amount sent");

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

        uint256 total = amount + _calculateInterest(msg.sender, currency);

        if (currency == address(0)) {
            _balances[msg.sender][address(0)].amount -= total;
            payable(msg.sender).transfer(total);
        } else {
            _balances[msg.sender][currency].amount -= total;
            IERC20(currency).transferFrom(address(this), msg.sender, total);
        }

        if (_balances[msg.sender][currency].amount == 0) {
            delete _balances[msg.sender][currency];
        }

        emit Withdraw(msg.sender, total);
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
