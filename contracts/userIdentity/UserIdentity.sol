// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/IUserIdentityACL.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UserIdentity {
    error CallerNotAllowed(address caller);
    error FundsNotReceived(address caller, address _contract);
    error UnexpectedError(bytes data);

    event LiquidityReceived(address from, uint256 amount);

    address private _owner;
    address private _acl;

    receive() external payable {
        emit LiquidityReceived(msg.sender, msg.value);

        // TODO: validate that only authorized contracts
        // can send money to this contract
    }

    constructor(address user, address acl) {
        _owner = user;
        _acl = acl;
    }

    modifier isAllowedToExecuteCall() {
        if (
            !IUserIdentityACL(_acl).isAllowedToExecuteCallFor(
                _owner,
                msg.sender
            )
        ) {
            revert CallerNotAllowed(msg.sender);
        }
        _;
    }

    function send(address targetContract, bytes calldata functionToCall)
        public
        payable
        isAllowedToExecuteCall
        returns (bool)
    {
        (bool success, bytes memory data) = targetContract.call{
            value: msg.value
        }(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        return success;
    }

    function retrieve(address targetContract, bytes calldata functionToCall)
        public
        isAllowedToExecuteCall
        returns (bool)
    {
        (bool success, bytes memory data) = targetContract.call(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        // TODO: Move to receive() function or find a way to avoid holding to funds if the transfer fails
        // TODO: Change address.balance for an independent variable
        // that tracks contract funds, it may be fragile if we rely on address.balance
        // to consider whether the service contract sent back the funds to the user
        if (address(this).balance > 0) {
            (bool transferSuccess, bytes memory transferData) = _owner.call{
                value: address(this).balance
            }("");

            if (!transferSuccess) {
                revert UnexpectedError(transferData);
            }
        } else {
            revert FundsNotReceived(msg.sender, targetContract);
        }

        return success;
    }

    function retrieveTokens(
        address targetContract,
        bytes calldata functionToCall,
        address token
    ) public isAllowedToExecuteCall returns (bool) {
        (bool success, bytes memory data) = targetContract.call(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        uint256 balance = ERC20(token).balanceOf(address(this));
        if (balance > 0) {
            ERC20(token).transfer(_owner, balance);
        } else {
            revert FundsNotReceived(msg.sender, targetContract);
        }

        return success;
    }

    function sendTokens(address targetContract, bytes calldata functionToCall, address token, uint256 amount, address kToken)
    public
    isAllowedToExecuteCall
    returns (bool)
    {
        uint256 balance = ERC20(token).balanceOf(_owner);
        if (balance >= amount) {
            ERC20(token).transferFrom(_owner, address(this), amount);
            ERC20(token).approve(address(kToken), amount);
        } else {
            revert FundsNotReceived(msg.sender, targetContract);
        }

        (bool success, bytes memory data) = targetContract.call(functionToCall);

        if (!success) {
            revert UnexpectedError(data);
        }

        return success;
    }

    function read(address targetContract, bytes calldata functionToCall)
        public
        view
        isAllowedToExecuteCall
        returns (bytes memory)
    {
        (bool success, bytes memory data) = targetContract.staticcall(
            functionToCall
        );

        if (!success) {
            revert UnexpectedError(data);
        }

        return data;
    }
}
