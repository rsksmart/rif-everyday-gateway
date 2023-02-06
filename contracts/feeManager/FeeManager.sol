// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import {IFeeManager} from "./IFeeManager.sol";
import "../access/GatewayAccessControl.sol";

/* solhint-disable avoid-low-level-calls */

/**
 * @title Fee Manager
 * @author RIF protocols team
 */
contract FeeManager is IFeeManager, Ownable, GatewayAccessControl {
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

    /**
     * @inheritdoc IFeeManager
     */
    function chargeFee(address debtor, address beneficiary)
        public
        override
        onlyRole(FINANCIAL_OWNER)
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

    /**
     * @inheritdoc IFeeManager
     */
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

    /**
     * @inheritdoc IFeeManager
     */
    function getDebtBalanceFor(address debtor, address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _amounts[keccak256(abi.encodePacked(debtor, beneficiary))];
    }

    /**
     * @inheritdoc IFeeManager
     */
    function getBalance(address beneficiary)
        external
        view
        override
        returns (uint256)
    {
        return _funds[beneficiary];
    }

    /**
     * @inheritdoc IFeeManager
     */
    function pay() external payable override {
        return _pay(msg.sender);
    }

    /**
     * @inheritdoc IFeeManager
     */
    function payInBehalfOf(address debtor) external payable override {
        return _pay(debtor);
    }

    /**
     * @inheritdoc IFeeManager
     */
    // slither-disable-next-line reentrancy-events
    function withdraw(uint256 amount) external override {
        if (msg.sender == _feesOwner) isFinancialOperator(msg.sender);
        if (amount > _funds[msg.sender]) {
            revert InsufficientFunds();
        }

        emit Withdraw(msg.sender, amount);

        _funds[msg.sender] -= amount;
        // slither-disable-next-line low-level-calls
        (bool success, ) = msg.sender.call{value: amount}("");

        if (!success) {
            revert RBTCTransferFailed();
        }
    }

    /**
     * @notice Pays fees from the debtor to beneficiaries in order
     * first to the service providers and then to the gateway
     * If there is any remaining balance the debtor will be able to
     * withdraw it from this contract
     * @param debtor The address of the debtor
     */
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
                _funds[msg.sender] += remainingFunds;
            }
        }
    }

    /**
     * @notice Pays fees from the debtor to beneficiaries
     * @param debtor The address of the debtor
     * @param funds The funds available to pay beneficiaries
     * @return The remaining funds after paying the beneficiaries
     */
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

    /**
     * @notice Pays fees from the debtor to the gateway
     * @param debtor The address of the debtor
     * @param funds The funds available to pay the gateway
     * @return The remaining funds after paying the gateway
     */
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
