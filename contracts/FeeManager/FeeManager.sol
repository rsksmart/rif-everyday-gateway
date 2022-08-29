// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {IFeeManager} from "./IFeeManager.sol";

contract FeeManager is IFeeManager {
    mapping(address => uint256) internal _beneficiares;

    function fundBeneficiary(address beneficiary) external payable override {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        _beneficiares[beneficiary] += msg.value;

        // TODO: add support for ERC20 tokens
        emit Deposit(beneficiary, msg.value);
    }

    function getBalance(address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _beneficiares[beneficiary];
    }

    function withdraw(uint256 amount) external override {
        if (amount > _beneficiares[msg.sender]) {
            revert InsufficientFunds();
        }

        _beneficiares[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");

        if (!success) {
            revert RBTCTransferFailed();
        }

        // TODO: add support for ERC20 tokens
        emit Withdraw(msg.sender, amount);
    }
}
