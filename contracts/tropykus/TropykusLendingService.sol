// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/LendingService.sol";
import "../services/LendingService.sol";
import "../userIdentity/UserIdentityFactory.sol";
import "../userIdentity/UserIdentity.sol";

contract TropykusLendingService is LendingService {
    address private _crbtc;
    UserIdentityFactory private _userIdentityFactory;
    uint256 constant _UNIT_DECIMAL_PRECISION = 1e18;

    constructor(address crbtc, UserIdentityFactory userIdentityFactory)
        LendingService("Tropykus")
    {
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

        emit Lend({
            listingId: 0,
            lender: msg.sender,
            currency: address(0),
            amount: msg.value
        });
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

        emit Withdraw({
            listingId: 0,
            withdrawer: msg.sender,
            currency: address(0),
            amount: (tokens * exchangeRate) / _UNIT_DECIMAL_PRECISION
        });
    }

    function getBalance(address currency)
        public
        view
        override(IService, Service)
        returns (uint256)
    {
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
        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165)
        returns (bool)
    {
        return
            interfaceId ==
            this.getBalance.selector ^
                this.addListing.selector ^
                this.disableListing.selector ^
                this.getListing.selector ^
                this.getListingsCount.selector ^
                this.updateListing.selector ^
                this.getServiceProviderName.selector ^
                this.getServiceType.selector ^
                this.lend.selector ^
                this.withdraw.selector ||
            interfaceId == this.supportsInterface.selector;
    }
}
