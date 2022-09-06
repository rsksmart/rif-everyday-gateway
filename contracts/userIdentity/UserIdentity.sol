// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/IUserIdentityACL.sol";

contract UserIdentity {
    error CallerNotAllowed(address _caller);

    address private _owner;
    address private _acl;

    constructor(address user, address acl) {
        _owner = user;
        _acl = acl;
    }

    modifier isAllowedToExecuteCall() {
        if (IUserIdentityACL(_acl).isAllowedToExecuteCallFor(_owner)) {
            revert CallerNotAllowed(msg.sender);
        }
        _;
    }

    function lend(bytes calldata functionToCall)
        public
        payable
        isAllowedToExecuteCall
        returns (bool)
    {
        address allowedLendingContract = IUserIdentityACL(_acl)
            .getAllowedContracts(msg.sender)
            .lending;

        (bool success, bytes memory data) = allowedLendingContract.call{
            value: msg.value
        }(functionToCall);

        return success;
    }

    function withdraw(bytes calldata functionToCall)
        public
        isAllowedToExecuteCall
        returns (bool)
    {
        address allowedLendingContract = IUserIdentityACL(_acl)
            .getAllowedContracts(msg.sender)
            .lending;

        (bool success, bytes memory data) = allowedLendingContract.call(
            functionToCall
        );

        if (address(this).balance > 0) {
            payable(_owner).transfer(address(this).balance);
        }

        return success;
    }
}
