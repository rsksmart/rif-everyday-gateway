// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../Services/LendingService.sol";

contract DummyLendingService is LendingService {
    constructor() {}

    function lend(
        uint256 amount,
        address currency,
        uint256 duration,
        PayBackOption payBackOption
    ) public payable override {
        emit Lend(msg.sender, currency);
    }

    function withdraw(uint256 amount, address currency) public override {
        emit Withdraw(msg.sender, currency);
    }

    function getBalance(address currency)
        public
        view
        override
        returns (uint256)
    {
        return 0;
    }
}
