// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/IUserIdentityACL.sol";

/**
  @title User Identity Access Control List
 */
contract UserIdentityACL is IUserIdentityACL {
    error CallerNotAllowed(address _caller);

    mapping(address => mapping(address => bool)) internal _allowedContractCalls;

    modifier canRetrieveIdentity(address user) {
        if (user != msg.sender && !_allowedContractCalls[user][msg.sender]) {
            revert CallerNotAllowed(msg.sender);
        }
        _;
    }

    function isAllowedToExecuteCallFor(address user)
        public
        view
        override
        returns (bool)
    {
        return _allowedContractCalls[user][msg.sender];
    }

    // TODO: split this function in two, authoriz and deny
    // to improve readability
    function authorize(address serviceProvider, bool approval) public override {
        _allowedContractCalls[msg.sender][serviceProvider] = approval;
    }
}
