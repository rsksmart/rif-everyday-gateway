// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

interface IUserIdentityACL {
    function authorize(address serviceProvider, bool approval) external;

    function isAllowedToExecuteCallFor(address user)
        external
        view
        returns (bool);

    function isAllowedToExecuteCallFor(address user, address caller)
        external
        view
        returns (bool);
}
