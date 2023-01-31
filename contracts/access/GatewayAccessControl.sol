// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

bytes32 constant OWNER = keccak256("OWNER");
bytes32 constant LOW_LEVEL_OPERATOR = keccak256("LOW_LEVEL_OPERATOR");
bytes32 constant HIGH_LEVEL_OPERATOR = keccak256("HIGH_LEVEL_OPERATOR");
bytes32 constant FINANCIAL_OWNER = keccak256("FINANCIAL_OWNER");
bytes32 constant FINANCIAL_OPERATOR = keccak256("FINANCIAL_OPERATOR");

/**
 * @title GatewayAccessControl
 * @author RIF Protocols Team
 * @dev The main contract that that handles the role and their access within the gateway.
 * This roles had been defined by the Security team.
 */
contract GatewayAccessControl is AccessControl, Ownable {
    /**
     * @notice Grants the default admin role OWNER to the deployer.
     * @dev The default admin role is keccak256("OWNER"), which means that
     * only accounts with this role will be able to grant or revoke
     * other roles. By default, this role is also granted to the
     * account that deploys the contract.
     */
    constructor() {
        _setRoleAdmin(OWNER, OWNER);
        _setupRole(OWNER, msg.sender);
    }

    /**
     * @notice Grants OWNER role and transfers ownership of the contract to the given address.
     * @param newOwner address to be grant OWNER role and transfer ownership.
     */
    function changeOwner(address newOwner) public onlyRole(OWNER) {
        grantRole(OWNER, newOwner);
        revokeRole(OWNER, msg.sender);
        transferOwnership(newOwner);
    }

    /**
     * @notice Checks if the given address has OWNER role.
     * @param owner address to check.
     * @return bool true if the given address has OWNER role.
     */
    function isOwner(address owner) public view returns (bool) {
        return hasRole(OWNER, owner);
    }

    function addLowLevelOperator(address lowOperator) public onlyRole(OWNER) {
        grantRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    function removeLowLevelOperator(address lowOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    function isLowLevelOperator(address lowOperator)
        public
        view
        returns (bool)
    {
        return hasRole(LOW_LEVEL_OPERATOR, lowOperator);
    }

    function addHighLevelOperator(address highOperator) public onlyRole(OWNER) {
        grantRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    function removeHighLevelOperator(address highOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    function isHighLevelOperator(address highOperator)
        public
        view
        returns (bool)
    {
        return hasRole(HIGH_LEVEL_OPERATOR, highOperator);
    }

    function addFinancialOwner(address financialOwner) public onlyRole(OWNER) {
        grantRole(FINANCIAL_OWNER, financialOwner);
    }

    function removeFinancialOwner(address financialOwner)
        public
        onlyRole(OWNER)
    {
        revokeRole(FINANCIAL_OWNER, financialOwner);
    }

    function isFinancialOwner(address financialOwner)
        public
        view
        returns (bool)
    {
        return hasRole(FINANCIAL_OWNER, financialOwner);
    }

    function addFinancialOperator(address financialOperator)
        public
        onlyRole(OWNER)
    {
        grantRole(FINANCIAL_OPERATOR, financialOperator);
    }

    function removeFinancialOperator(address financialOperator)
        public
        onlyRole(OWNER)
    {
        revokeRole(FINANCIAL_OPERATOR, financialOperator);
    }

    function isFinancialOperator(address financialOperator)
        public
        view
        returns (bool)
    {
        return hasRole(FINANCIAL_OPERATOR, financialOperator);
    }
}
