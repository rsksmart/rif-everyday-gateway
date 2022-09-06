// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "contracts/userIdentity/UserIdentity.sol";
import "contracts/userIdentity/IUserIdentityACL.sol";

interface IUserIdentityFactory is IUserIdentityACL {
    function getIdentity(address user) external returns (UserIdentity);
}
