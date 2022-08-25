// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ACMELending {
  event Deposit(address indexed _from, uint256 _amount);
  event Withdraw(address indexed _from, uint256 _amount);

  mapping(address => mapping(address => uint256)) private _balances;
  uint256 private _subsidy = 0;

  function deposit(address currency, uint256 amount) public payable {
    require(msg.value > 0 || amount > 0, "No tokens sent");

    if (currency == address(0)) {
      _balances[msg.sender][address(0)] += msg.value;
    } else {
      IERC20(currency).transferFrom(msg.sender, address(this), amount);
      _balances[msg.sender][currency] += amount;
    }

    emit Deposit(msg.sender, amount);
  }

  function withdraw(address currency, uint256 amount) public {
    require(_balances[msg.sender][currency] > 0, "Not enough balance");

    if (currency == address(0)) {
      _balances[msg.sender][address(0)] -= amount;
      payable(msg.sender).transfer(amount);
    } else {
      _balances[msg.sender][currency] -= amount;
      IERC20(currency).transferFrom(address(this), msg.sender, amount);
    }
  }

  function getBalance(address currency) public view returns (uint256) {
    return _balances[msg.sender][currency];
  }

  function _calculateInterest() private view {

  }
}