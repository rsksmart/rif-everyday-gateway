// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import {IFeeManager} from "./IFeeManager.sol";

/* solhint-disable avoid-low-level-calls */

contract FeeManager is IFeeManager, Ownable {
    uint256 internal immutable _fixedOwnerFee = 1 gwei;
    uint256 internal immutable _fixedBeneficiaryFee = 1 gwei;

    address private _feesOwner;

    // Applies to service providers
    // debtor => beneficiary address
    mapping(address => address[]) internal _creditors;

    // Applies to amount of debt for keccak256(abi.encodePacked(debtor,beneficiary))
    mapping(bytes32 => uint256) internal _amounts;

    // Funds for each account
    mapping(address => uint256) internal _funds;

    constructor(address feesOwner) {
        _feesOwner = feesOwner;
    }

    function chargeFee(address debtor, address beneficiary)
        public
        override
        onlyOwner
    {
        if (beneficiary != address(0)) {
            bytes32 amountKey = keccak256(
                abi.encodePacked(debtor, beneficiary)
            );

            if (_amounts[amountKey] == 0) {
                _creditors[debtor].push(beneficiary);
            }

            _amounts[amountKey] += _fixedBeneficiaryFee;
        }

        _amounts[
            keccak256(abi.encodePacked(debtor, _feesOwner))
        ] += _fixedOwnerFee;

        emit ServiceConsumptionFee(
            debtor,
            _fixedOwnerFee,
            beneficiary,
            _fixedBeneficiaryFee
        );
    }

    function getDebtBalance(address debtor)
        external
        view
        override
        returns (uint256 balance)
    {
        for (uint256 i = 0; i < _creditors[debtor].length; i++) {
            balance += _amounts[
                keccak256(abi.encodePacked(debtor, _creditors[debtor][i]))
            ];
        }

        balance += _amounts[keccak256(abi.encodePacked(debtor, _feesOwner))];
    }

    function getDebtBalanceFor(address debtor, address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _amounts[keccak256(abi.encodePacked(debtor, beneficiary))];
    }

    function getBalance(address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _funds[beneficiary];
    }

    function pay() external payable override {
        return _pay(msg.sender);
    }

    function payInBehalfOf(address debtor) external payable override {
        return _pay(debtor);
    }

    function withdraw(uint256 amount) external override {
        if (amount > _funds[msg.sender]) {
            revert InsufficientFunds();
        }

        _funds[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");

        if (!success) {
            revert RBTCTransferFailed();
        }

        // TODO: add support for ERC20 tokens
        emit Withdraw(msg.sender, amount);
    }

    function _pay(address debtor) internal {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        bytes32 ownerAmountKey = keccak256(
            abi.encodePacked(debtor, _feesOwner)
        );

        if (_creditors[debtor].length == 0 && _amounts[ownerAmountKey] == 0) {
            revert NoPendingFees();
        }

        uint256 remainingFunds = _payBeneficiaries(debtor, msg.value);

        if (remainingFunds > 0) {
            remainingFunds = _payOwner(debtor, remainingFunds);

            if (remainingFunds > 0) {
                (bool success, ) = msg.sender.call{value: remainingFunds}("");

                if (!success) {
                    // If the msg.sender can't receive the remaining funds, store them for future withdrawal
                    _funds[msg.sender] += remainingFunds;
                }
            }
        }
    }

    function _payBeneficiaries(address debtor, uint256 funds)
        internal
        returns (uint256)
    {
        while (funds > 0 && _creditors[debtor].length > 0) {
            address beneficiary = _creditors[debtor][0];
            bytes32 amountsKey = keccak256(
                abi.encodePacked(debtor, beneficiary)
            );

            uint256 payment = 0;
            if (_amounts[amountsKey] > funds) {
                payment = funds;
            } else {
                payment = _amounts[amountsKey];
                _creditors[debtor][0] = _creditors[debtor][
                    _creditors[debtor].length - 1
                ];
                _creditors[debtor].pop();
            }

            funds -= payment;
            _amounts[amountsKey] -= payment;
            _funds[beneficiary] += payment;

            emit FeePayment(debtor, beneficiary, payment);
        }

        return funds;
    }

    function _payOwner(address debtor, uint256 funds)
        internal
        returns (uint256)
    {
        bytes32 amountsKey = keccak256(abi.encodePacked(debtor, _feesOwner));
        uint256 ownerPayment = _amounts[amountsKey] < funds
            ? _amounts[amountsKey]
            : funds;

        funds -= ownerPayment;
        _amounts[amountsKey] -= ownerPayment;
        _funds[_feesOwner] += ownerPayment;

        emit FeePayment(debtor, _feesOwner, ownerPayment);

        return funds;
    }
}
