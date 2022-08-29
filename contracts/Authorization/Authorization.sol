// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAuthorization} from "./IAuthorization.sol";
import {OWNER, SERVICE_PROVIDER, WALLET_PROVIDER} from "./Roles.sol";

contract Authorization is IAuthorization, AccessControl {
    constructor() {
        _setRoleAdmin(OWNER, OWNER);
        _setRoleAdmin(WALLET_PROVIDER, OWNER);
        _setRoleAdmin(SERVICE_PROVIDER, OWNER);

        _setupRole(OWNER, msg.sender);
    }

    function isOwner(address owner) external view override returns (bool) {
        return hasRole(OWNER, owner);
    }

    function isServiceProvider(address serviceProvider)
        external
        view
        override
        returns (bool)
    {
        return hasRole(SERVICE_PROVIDER, serviceProvider);
    }

    function isWalletProvider(address walletProvider)
        external
        view
        override
        returns (bool)
    {
        return hasRole(WALLET_PROVIDER, walletProvider);
    }

    function addOwner(address owner) external override {
        grantRole(OWNER, owner);
    }

    function addServiceProvider(address serviceProvider) external override {
        grantRole(SERVICE_PROVIDER, serviceProvider);
    }

    function addWalletProvider(address walletProvider) external override {
        grantRole(WALLET_PROVIDER, walletProvider);
    }
}
