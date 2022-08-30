// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/Services/LendingService.sol";
import "contracts/Services/ACMELending.sol";

contract DummyLendingService is LendingService {
    error InvalidAmount(uint256 amount);

    ACMELending private _acmeLending;

    struct Lending {
        uint256 id;
        uint256 duration;
        uint256 amount;
        PayBackOption payBackOption;
    }

    mapping(address => mapping(uint256 => Lending)) private _lendings;

    mapping(address => uint256) private _lendingCounter;

    constructor(ACMELending acmeLending) {
        _acmeLending = acmeLending;
    }

    function lend(
        uint256 duration,
        PayBackOption payBackOption
    ) public payable override {
        if (msg.value <= 0) {
            revert InvalidAmount(msg.value);
        }

        uint256 amount = msg.value;

        uint256 newLendingId = _lendingCounter[msg.sender] + 1;

        _lendings[msg.sender][newLendingId] = Lending(newLendingId, duration, amount, payBackOption);

        _acmeLending.deposit{value: amount}();

        emit Lend(msg.sender, address(0), amount);
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
