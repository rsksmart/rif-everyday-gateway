// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/userIdentity/IUserIdentityACL.sol";

/**
  @title User Identity Access Control List
 */
contract UserIdentityACL is Ownable, IUserIdentityACL {
    error CallerNotAllowed(address _caller);

    mapping(address => mapping(address => AllowedContracts))
        internal _allowedContractCalls;

    modifier canRetrieveIdentity(address user) {
        if (
            user != msg.sender &&
            _allowedContractCalls[user][msg.sender].lending == address(0x0)
        ) {
            revert CallerNotAllowed(msg.sender);
        }
        _;
    }

    function isAllowedToExecuteCallFor(address user)
        public
        view
        returns (bool)
    {
        return _allowedContractCalls[user][msg.sender].lending != address(0x0);
    }

    function getAllowedContracts(address user, address provider)
        public
        view
        returns (AllowedContracts memory)
    {
        return _allowedContractCalls[user][provider];
    }

    function allowLendingProvider(
        address user,
        address caller,
        address callee
    ) public onlyOwner {
        _allowedContractCalls[user][caller].lending = callee;
    }
}
