// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {IFeeManager} from "./IFeeManager.sol";
import {ISubscriber} from "../common/IPublisher.sol";

import "hardhat/console.sol";

contract FeeManager is IFeeManager, ISubscriber {
    // TODO: should fee be something that can be changed/dynamic?
    // if so, this can be placed somewhere where the Defi Gateway
    // changes service consumption fees depending on other factors
    uint256 internal immutable _FIXED_SERVICE_CONSUMPTION_FEE = 1 gwei;

    mapping(address => uint256) internal _beneficiares;
    // this mapping only applies to service providers
    mapping(address => uint256) internal _debtors;

    function update(address debtor) external {
        chargeFee(debtor, _FIXED_SERVICE_CONSUMPTION_FEE);
    }

    function chargeFee(address debtor, uint256 fee) public {
        if (fee == 0) {
            revert InvalidFee();
        }

        _debtors[debtor] += fee;

        emit ServiceConsumed(debtor, fee);
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

    function getDebtBalance(address debtor)
        external
        view
        override
        returns (uint256)
    {
        return _debtors[debtor];
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
