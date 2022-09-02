// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/LendingService.sol";
import "contracts/mocks/ACMELending.sol";

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

    function withdraw() public override {
        (uint256 deposited, uint256 interest) = _acmeLending.getBalance(
            msg.sender
        );
        _acmeLending.withdraw(deposited, msg.sender);

        emit Withdraw(msg.sender, address(0), deposited + interest);
    }

    function getBalance() public view override returns (uint256) {
        (uint256 deposited, uint256 interest) = _acmeLending.getBalance(
            msg.sender
        );
        return deposited + interest;
    }
}
