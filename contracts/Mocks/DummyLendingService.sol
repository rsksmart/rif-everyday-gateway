// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/Services/LendingService.sol";
import "contracts/Services/ACMELending.sol";

contract DummyLendingService is LendingService {
    error InvalidAmount(uint256 amount);

    ACMELending private _acmeLending;

    constructor(ACMELending acmeLending) {
        _acmeLending = acmeLending;
    }

    function lend(uint256 duration, PayBackOption payBackOption)
        public
        payable
        override
    {
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        _acmeLending.deposit{value: msg.value}(msg.sender);

        emit Lend(msg.sender, address(0), msg.value);
    }

    function withdraw(uint256 amount) public override {
        if (amount == 0) {
            revert InvalidAmount(amount);
        }

        _acmeLending.withdraw(amount, msg.sender);

        emit Withdraw(msg.sender, address(0), amount);
    }

    function getBalance() public view override returns (uint256) {
        (uint256 deposited, uint256 interest) = _acmeLending.getBalance(
            msg.sender
        );
        return deposited + interest;
    }
}
