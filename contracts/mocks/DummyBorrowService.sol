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
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        require(amount < listings[index].maxAmount, "Liquidity exceeded");
        require(amount > listings[index].minAmount, "Min amount not met");

        _acme.deposit{value: msg.value}(msg.sender);
        _acme.loan(currency, amount, msg.sender);

        _removeLiquidityInternal(amount, index);

        emit Borrow(index, msg.sender, currency, amount, duration);
    }

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) public payable override {
        ERC20(currency).transferFrom(msg.sender, address(this), amount);
        ERC20(currency).approve(address(_acme), amount);
        _acme.repay(currency, amount, address(this), msg.sender);

        emit Pay(index, msg.sender, currency, amount);
    }

    function withdraw() public override {}

    function getBalance(address currency)
        public
        view
        override
        returns (uint256)
    {
        return _acme.getDebtBalance(currency, msg.sender);
    }
}
