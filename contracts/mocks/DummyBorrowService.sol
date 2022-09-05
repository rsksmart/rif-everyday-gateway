// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/BorrowService.sol";
import "contracts/mocks/ACME.sol";

contract DummyBorrowService is BorrowService {
    ACME private _acme;

    constructor(ACME acme) {
        _acme = acme;
    }

    function borrow(
        uint256 amount,
        address currency,
        uint256 index,
        uint256 duration
    ) public payable override {
        require(amount > 0, "Non zero borrows");
        require(
            amount < listings[currency][index].maxAmount,
            "Liquidity exceeded"
        );
        require(
            amount > listings[currency][index].minAmount,
            "Min amount not met"
        );

        _acme.deposit{value: msg.value}(msg.sender);
        _acme.loan(currency, amount, msg.sender);

        removeLiquidity(amount, currency, index);

        emit Borrow(index, msg.sender, currency, amount, duration);
    }

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) public payable override {
        emit Pay(index, msg.sender, currency, amount);
    }
}
