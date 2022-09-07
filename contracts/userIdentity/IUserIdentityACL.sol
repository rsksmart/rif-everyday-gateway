// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

interface IUserIdentityACL {
    struct AllowedContracts {
        address lending;
    }

    function allowLendingProvider(
        address user,
        address caller,
        address callee
    ) external;

    function isAllowedToExecuteCallFor(address user)
        external
        view
        returns (bool);

    function getAllowedContracts(address user, address provider)
        external
        view
        returns (AllowedContracts memory);
}
