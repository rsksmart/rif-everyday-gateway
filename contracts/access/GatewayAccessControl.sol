// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IGatewayAccessControl.sol";
import "./Roles.sol";

/**
 * @title GatewayAccessControl
 * @author RIF Protocols Team
 * @dev The main contract that that handles the role and their access within the gateway.
 * This roles had been defined by the Security team and each address should from a multisig wallet.
 */
contract GatewayAccessControl is IGatewayAccessControl, AccessControl, Ownable {
    /**
     * @notice Grants the default admin role OWNER to the deployer.
     * @dev The default admin role is keccak256("OWNER"), which means that
     * only accounts with this role will be able to grant or revoke
     * other roles. By default, this role is also granted to the
     * account that deploys the contract.
     */
    constructor() {
        _setRoleAdmin(OWNER, OWNER);
        _setRoleAdmin(LOW_LEVEL_OPERATOR, OWNER);
        _setRoleAdmin(HIGH_LEVEL_OPERATOR, OWNER);
        _setRoleAdmin(FINANCIAL_OWNER, OWNER);
        _setRoleAdmin(FINANCIAL_OPERATOR, OWNER);

        _setupRole(OWNER, msg.sender);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function changeOwner(address newOwner) public onlyRole(OWNER) {
        grantRole(OWNER, newOwner);
        revokeRole(OWNER, owner());
        transferOwnership(newOwner);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function isOwner(address owner) public view returns (bool) {
        return hasRole(OWNER, owner);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function addLowLevelOperator(address lowOperator) public onlyRole(OWNER) {
        grantRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function removeLowLevelOperator(address lowOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function isLowLevelOperator(address lowOperator)
        public
        view
        returns (bool)
    {
        return hasRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function addHighLevelOperator(address highOperator) public onlyRole(OWNER) {
        grantRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function removeHighLevelOperator(address highOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function isHighLevelOperator(address highOperator)
        public
        view
        returns (bool)
    {
        return hasRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function addFinancialOwner(address financialOwner) public onlyRole(OWNER) {
        grantRole(FINANCIAL_OWNER, financialOwner);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function removeFinancialOwner(address financialOwner)
        public
        onlyRole(OWNER)
    {
        revokeRole(FINANCIAL_OWNER, financialOwner);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function isFinancialOwner(address financialOwner)
        public
        view
        returns (bool)
    {
        return hasRole(FINANCIAL_OWNER, financialOwner);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function addFinancialOperator(address financialOperator)
        public
        onlyRole(OWNER)
    {
        grantRole(FINANCIAL_OPERATOR, financialOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function removeFinancialOperator(address financialOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(FINANCIAL_OPERATOR, financialOperator);
    }

    /**
     * @inheritdoc IGatewayAccessControl
     */
    function isFinancialOperator(address financialOperator)
        public
        view
        returns (bool)
    {
        return hasRole(FINANCIAL_OPERATOR, financialOperator);
    }
}
