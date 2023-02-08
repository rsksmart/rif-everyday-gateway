// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

bytes32 constant OWNER = keccak256("OWNER");
bytes32 constant LOW_LEVEL_OPERATOR = keccak256("LOW_LEVEL_OPERATOR");
bytes32 constant HIGH_LEVEL_OPERATOR = keccak256("HIGH_LEVEL_OPERATOR");
bytes32 constant FINANCIAL_OWNER = keccak256("FINANCIAL_OWNER");
bytes32 constant FINANCIAL_OPERATOR = keccak256("FINANCIAL_OPERATOR");

/**
 * @title IGatewayAccessControl
 * @author RIF Protocols Team
 * @dev The main contract that that handles the role and their access within the gateway.
 * This roles had been defined by the Security team and each address should from a multisig wallet.
 */
interface IGatewayAccessControl {
    /**
     * @notice Grants OWNER role and transfers ownership of the contract to the given address.
     * @param newOwner address to be grant OWNER role and transfer ownership.
     */
    function changeOwner(address newOwner) external;

    /**
     * @notice Checks if the given address has OWNER role.
     * @param owner address to check.
     * @return bool true if the given address has OWNER role.
     */
    function isOwner(address owner) external view returns (bool);

    /**
     * @notice Grants LOW_LEVEL_OPERATOR role to the given address.
     * @param lowOperator address to be grant LOW_LEVEL_OPERATOR role.
     */
    function addLowLevelOperator(address lowOperator) external;

    /**
     * @notice Revokes LOW_LEVEL_OPERATOR role to the given address.
     * @param lowOperator address to be revoke LOW_LEVEL_OPERATOR role.
     */
    function removeLowLevelOperator(address lowOperator) external;

    /**
     * @notice Checks if the given address has LOW_LEVEL_OPERATOR role.
     * @param lowOperator address to check.
     * @return bool true if the given address has LOW_LEVEL_OPERATOR role.
     */
    function isLowLevelOperator(address lowOperator)
        external
        view
        returns (bool);

    /**
     * @notice Grants HIGH_LEVEL_OPERATOR role to the given address.
     * @param highOperator address to be grant HIGH_LEVEL_OPERATOR role.
     */
    function addHighLevelOperator(address highOperator) external;

    /**
     * @notice Revokes HIGH_LEVEL_OPERATOR role to the given address.
     * @param highOperator address to be revoke HIGH_LEVEL_OPERATOR role.
     */
    function removeHighLevelOperator(address highOperator) external;

    /**
     * @notice Checks if the given address has HIGH_LEVEL_OPERATOR role.
     * @param highOperator address to check.
     * @return bool true if the given address has HIGH_LEVEL_OPERATOR role.
     */
    function isHighLevelOperator(address highOperator)
        external
        view
        returns (bool);

    /**
     * @notice Grants FINANCIAL_OWNER role to the given address.
     * @param financialOwner address to be grant FINANCIAL_OWNER role.
     */
    function addFinancialOwner(address financialOwner) external;

    /**
     * @notice Revokes FINANCIAL_OWNER role to the given address.
     * @param financialOwner address to be revoke FINANCIAL_OWNER role.
     */
    function removeFinancialOwner(address financialOwner) external;

    /**
     * @notice Checks if the given address has FINANCIAL_OWNER role.
     * @param financialOwner address to check.
     * @return bool true if the given address has FINANCIAL_OWNER role.
     */
    function isFinancialOwner(address financialOwner)
        external
        view
        returns (bool);

    /**
     * @notice Grants FINANCIAL_OPERATOR role to the given address.
     * @param financialOperator address to be grant FINANCIAL_OPERATOR role.
     */
    function addFinancialOperator(address financialOperator) external;

    /**
     * @notice Revokes FINANCIAL_OPERATOR role to the given address.
     * @param financialOperator address to be revoke FINANCIAL_OPERATOR role.
     */
    function removeFinancialOperator(address financialOperator) external;

    /**
     * @notice Checks if the given address has FINANCIAL_OPERATOR role.
     * @param financialOperator address to check.
     * @return bool true if the given address has FINANCIAL_OPERATOR role.
     */
    function isFinancialOperator(address financialOperator)
        external
        view
        returns (bool);
}
