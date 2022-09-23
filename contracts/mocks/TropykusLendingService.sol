// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../services/LendingService.sol";
import "../userIdentity/UserIdentityFactory.sol";
import "./ICRBTC.sol";
import "../userIdentity/UserIdentity.sol";

contract TropykusLendingService is LendingService {
    address private _crbtc;
    UserIdentityFactory private _userIdentityFactory;

    constructor(address crbtc, UserIdentityFactory userIdentityFactory) {
        _crbtc = crbtc;
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
            address(_crbtc),
            abi.encodeWithSignature("mint()")
        );

        emit Lend(msg.sender, address(0), msg.value);
    }

    function withdraw() public override {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);
        bytes memory balanceData = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(identity))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        identity.retrieve(
            address(_crbtc),
            abi.encodeWithSignature("redeem(uint256)", tokens)
        );

        bytes memory data = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(data, (uint256));

        emit Withdraw(msg.sender, address(0), (tokens * exchangeRate) / 1e18);
    }

    function getBalance() public view override returns (uint256) {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        bytes memory data = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(data, (uint256));

        bytes memory balanceData = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(identity))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));
        return (exchangeRate * tokens) / 1e18;
    }
}
