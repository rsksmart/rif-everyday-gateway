// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/IUserIdentityACL.sol";

contract UserIdentity {
    error CallerNotAllowed(address _caller);
    error UnexpectedError();

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

    function send(bytes calldata functionToCall)
        public
        payable
        isAllowedToExecuteCall
        returns (bool)
    {
        address allowedLendingContract = IUserIdentityACL(_acl)
            .getAllowedContracts(_owner, msg.sender)
            .lending;

        (bool success, ) = allowedLendingContract.call{value: msg.value}(
            functionToCall
        );

        if (!success) {
            revert UnexpectedError();
        }

        return success;
    }

    function retrieve(bytes calldata functionToCall)
        public
        isAllowedToExecuteCall
        returns (bool)
    {
        address allowedLendingContract = IUserIdentityACL(_acl)
            .getAllowedContracts(_owner, msg.sender)
            .lending;

        (bool success, ) = allowedLendingContract.call(functionToCall);

        if (!success) {
            revert UnexpectedError();
        }

        if (address(this).balance > 0) {
            payable(_owner).transfer(address(this).balance);
        }

        return success;
    }

    function read(bytes calldata functionToCall)
        public
        view
        isAllowedToExecuteCall
        returns (bytes memory)
    {
        address allowedLendingContract = IUserIdentityACL(_acl)
            .getAllowedContracts(_owner, msg.sender)
            .lending;

        (, bytes memory data) = allowedLendingContract.staticcall(
            functionToCall
        );

        return data;
    }
}
