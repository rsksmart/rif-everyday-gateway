// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {IFeeManager} from "./IFeeManager.sol";
import {ISubscriber} from "../common/IPublisher.sol";

contract FeeManager is IFeeManager {
    uint256 internal immutable _FIXED_SERVICE_CONSUMPTION_FEE = 1 gwei;

    mapping(address => uint256) internal _beneficiaries;
    // this mapping only applies to service providers
    mapping(address => uint256) internal _debtors;

    function chargeFee(address debtor) public override {
        _debtors[debtor] += _FIXED_SERVICE_CONSUMPTION_FEE;

        emit ServiceConsumed(debtor, _FIXED_SERVICE_CONSUMPTION_FEE);
    }

    function payDebt() public payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        if (_debtors[msg.sender] == 0) {
            revert("no debt");
        }

        _debtors[msg.sender] -= msg.value;

        emit DebtPayed(msg.sender, msg.value);
    }

    function fundBeneficiary(address beneficiary) external payable override {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        _beneficiaries[beneficiary] += msg.value;

        // TODO: add support for ERC20 tokens
        emit Deposit(beneficiary, msg.value);
    }

    function getBalance(address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _beneficiaries[beneficiary];
    }

    function getDebtBalance(address debtor)
        external
        view
        override
        returns (uint256)
    {
        return _debtors[debtor];
    }

    function withdraw(uint256 amount) external override {
        if (amount > _beneficiaries[msg.sender]) {
            revert InsufficientFunds();
        }

        _beneficiaries[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");

        if (!success) {
            revert RBTCTransferFailed();
        }

        // TODO: add support for ERC20 tokens
        emit Withdraw(msg.sender, amount);
    }
}
