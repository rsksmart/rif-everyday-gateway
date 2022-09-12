// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/UserIdentityACL.sol";
import "contracts/userIdentity/IUserIdentityFactory.sol";

contract UserIdentityFactory is UserIdentityACL, IUserIdentityFactory {
    mapping(address => UserIdentity) private _identities;

    function getIdentity(address user)
        public
        view
        canRetrieveIdentity(user)
        returns (UserIdentity)
    {
        return _identities[user];
    }

    function createIdentity(address user) public canRetrieveIdentity(user) {
        if (address(_identities[user]) == address(0x0)) {
            _identities[user] = new UserIdentity(user, address(this));
        }
    }
}
