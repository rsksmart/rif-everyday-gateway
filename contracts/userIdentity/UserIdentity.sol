// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/IUserIdentityACL.sol";

contract UserIdentity {
    error CallerNotAllowed(address _caller);
    error FundsNotReceived(address _caller, address _contract);
    error UnexpectedError(bytes data);

    event ReceivedLiquidity(address _from, uint256 _amount);

    address private _owner;
    address private _acl;

    receive() external payable {
        emit ReceivedLiquidity(msg.sender, msg.value);
    }

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

    function send(address contractToCall, bytes calldata functionToCall)
        public
        payable
        isAllowedToExecuteCall
        returns (bool)
    {
        (bool success, bytes memory data) = contractToCall.call{
            value: msg.value
        }(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        return success;
    }

    function retrieve(address contractToCall, bytes calldata functionToCall)
        public
        isAllowedToExecuteCall
        returns (bool)
    {
        (bool success, bytes memory data) = contractToCall.call(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        // TODO: Move to receive() function or find a way to avoid holding to funds if the transfer fails
        if (address(this).balance > 0) {
            (bool transferSuccess, bytes memory transferData) = _owner.call{
                value: address(this).balance
            }("");

            if (!transferSuccess) {
                revert UnexpectedError(transferData);
            }
        } else {
            revert FundsNotReceived(msg.sender, contractToCall);
        }

        return success;
    }

    function read(address contractToCall, bytes calldata functionToCall)
        public
        view
        isAllowedToExecuteCall
        returns (bytes memory)
    {
        (bool success, bytes memory data) = contractToCall.staticcall(
            functionToCall
        );
        if (!success) {
            revert UnexpectedError(data);
        }

        return data;
    }
}
