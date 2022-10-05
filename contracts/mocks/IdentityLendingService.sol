// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/services/LendingService.sol";
import "contracts/userIdentity/UserIdentityFactory.sol";
import "contracts/mocks/ACME.sol";

contract IdentityLendingService is LendingService {
    ACME private _acmeLending;
    UserIdentityFactory private _userIdentityFactory;

    constructor(ACME acmeLending, UserIdentityFactory userIdentityFactory) {
        _acmeLending = acmeLending;
        _userIdentityFactory = userIdentityFactory;
    }

    function lend() public payable override {
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        UserIdentityFactory(_userIdentityFactory).createIdentity(msg.sender);
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        identity.send{value: msg.value}(
            address(_acmeLending),
            abi.encodeWithSignature("deposit()")
        );

        emit Lend(0, msg.sender, address(0), msg.value);
    }

    function withdraw() public override {
        UserIdentityFactory(_userIdentityFactory).createIdentity(msg.sender);
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        bytes memory data = identity.read(
            address(_acmeLending),
            abi.encodeWithSignature("getBalance()")
        );

        (uint256 deposited, uint256 interest) = abi.decode(
            data,
            (uint256, uint256)
        );

        identity.retrieve(
            address(_acmeLending),
            abi.encodeWithSignature("withdraw(uint256)", deposited)
        );

        emit Withdraw(0, msg.sender, address(0), deposited + interest);
    }

    function getBalance(address currency) public view override returns (uint256) {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        if (address(identity) == address(0x0)) {
            return 0;
        }

        bytes memory data = identity.read(
            address(_acmeLending),
            abi.encodeWithSignature("getBalance()")
        );

        (uint256 deposited, uint256 interest) = abi.decode(
            data,
            (uint256, uint256)
        );

        return deposited + interest;
    }
}
