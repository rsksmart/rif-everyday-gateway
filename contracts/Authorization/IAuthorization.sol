// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @notice Handles all the roles-authorization operations within the
 * RIF Gateway, adding/removing roles, check roles etc
 *
 * Roles:
 *
 *    OWNER: is authorized of everything in the Gateway
 *    SERVICE_PROVIDER: add capabilities specifically for service providers (list services, reputation, staking etc)
 *    WALLET_PROVIDER: add capabilities specifically for wallet providers (reputation)
 */
interface IAuthorization {
    /**
     * @notice Throws when the caller is not authorized
     * to do a certain action in the Gateway
     */
    error NotAuthorized(address caller, bytes32 role);

    /**
     * @notice grants `OWNER` role to `owner`
     */
    function addOwner(address owner) external;

    /**
     * @notice grants `SERVICE_PROVIDER` role to `serviceProvider`
     */
    function addServiceProvider(address serviceProvider) external;

    /**
     * @notice grants `WALLET_PROVIDER` role to `walletProvider`
     */
    function addWalletProvider(address walletProvider) external;

    /**
     * @notice checks if `walletProvider` has `WALLET_PROVIDER` role
     */
    function isOwner(address owner) external view returns (bool);

    /**
     * @notice checks if `servideProvider` has `SERVICE_PROVIDER` role
     */
    function isServiceProvider(address serviceProvider)
        external
        view
        returns (bool);

    /**
     * @notice checks if `walletProvider` has `WALLET_PROVIDER` role
     */
    function isWalletProvider(address walletProvider)
        external
        view
        returns (bool);
}
