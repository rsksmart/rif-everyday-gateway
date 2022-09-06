// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/services/LendingService.sol";
import "contracts/userIdentity/UserIdentityFactory.sol";
import "contracts/mocks/ACMELending.sol";

contract DummierLendingService is LendingService {
    error InvalidAmount(uint256 amount);

    ACMELending private _acmeLending;
    UserIdentityFactory private _userIdentityFactory;

    constructor(
        ACMELending acmeLending,
        UserIdentityFactory userIdentityFactory
    ) {
        _acmeLending = acmeLending;
        _userIdentityFactory = userIdentityFactory;
    }

    function lend(uint256 duration, PayBackOption payBackOption)
        public
        payable
        override
    {
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }

        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        identity.lend{value: msg.value}(abi.encodeWithSignature("deposit()"));

        emit Lend(msg.sender, address(0), msg.value);
    }

    function withdraw() public override {
        (uint256 deposited, uint256 interest) = _acmeLending.getBalance(
            msg.sender
        );
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        identity.withdraw(abi.encodeWithSignature("withdraw()"));

        emit Withdraw(msg.sender, address(0), deposited + interest);
    }

    function getBalance() public view override returns (uint256) {
        (uint256 deposited, uint256 interest) = _acmeLending.getBalance(
            msg.sender
        );
        return deposited + interest;
    }
}
