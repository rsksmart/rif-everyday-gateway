// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "./ISmartWalletFactory.sol";
import "./SmartWallet.sol";
import {ISubscriber, SubscriptionEvent} from "../common/IPublisher.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWalletFactory is ISmartWalletFactory {
    address private _feeManager;

    constructor(address feeManager) {
        _feeManager = feeManager;
    }

    /**
     * Calculates the Smart Wallet address for an owner EOA
     * @param owner - EOA of the owner of the smart wallet
     */
    function getSmartWalletAddress(address owner)
        external
        view
        override
        returns (address)
    {
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                keccak256(
                                    abi.encodePacked(owner, address(this), "0")
                                ), // salt
                                keccak256(_getBytecode(owner))
                            )
                        )
                    )
                )
            );
    }

    function _getBytecode(address owner) private view returns (bytes memory) {
        bytes memory bytecode = type(SmartWallet).creationCode;

        return abi.encodePacked(bytecode, abi.encode(owner));
    }

    function createUserSmartWallet(address owner) external override {
        _deploy(
            owner,
            keccak256(
                abi.encodePacked(
                    owner,
                    address(this),
                    "0" /* INDEX */
                ) // salt
            )
        );
    }

    function _deploy(address owner, bytes32 salt)
        internal
        returns (address addr)
    {
        //Deployment of the Smart Wallet
        SmartWallet sm = new SmartWallet{salt: salt}(owner);

        // Initial subscription
        sm.subscribe(
            ISubscriber(_feeManager),
            SubscriptionEvent.SERVICE_CONSUMPTION
        );

        //No info is returned, an event is emitted to inform the new deployment
        addr = address(sm);
        emit Deployed(addr, uint256(salt));
    }

    function getSmartWallet(address owner) public returns (SmartWallet) {
        address smartWalletAddress = this.getSmartWalletAddress(owner);
        uint32 size;
        assembly {
            size := extcodesize(smartWalletAddress)
        }

        if (size == 0) {
            this.createUserSmartWallet(owner);
        }
        return SmartWallet(payable(smartWalletAddress));
    }
}
