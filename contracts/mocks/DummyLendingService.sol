// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/LendingService.sol";
import "contracts/mocks/ACME.sol";

contract DummyLendingService is LendingService {
    ACME private _acme;

    constructor(ACME acme) {
        _acme = acme;
    }

    function lend() public payable override {
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        _acme.deposit{value: msg.value}(msg.sender);

        emit Lend(0, msg.sender, address(0), msg.value);
    }

    function withdraw() public override {
        (uint256 deposited, uint256 interest) = _acme.getBalance(msg.sender);
        _acme.withdraw(deposited, msg.sender);

        emit Withdraw(0, msg.sender, address(0), deposited + interest);
    }

    function getBalance(address currency)
        public
        view
        override
        returns (uint256)
    {
        (uint256 deposited, uint256 interest) = _acme.getBalance(msg.sender);
        return deposited + interest;
    }
}
