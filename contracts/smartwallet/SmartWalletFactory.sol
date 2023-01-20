// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "./ISmartWalletFactory.sol";
import "./SmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * @title SmartWalletFactory
 * @dev Factory contract for creating SmartWallets
 * Based on rif-relay-contracts factory/SmartWalletFactory.sol
 * @author RIF protocols team
 */
contract SmartWalletFactory is ISmartWalletFactory {
    /**
     * @inheritdoc ISmartWalletFactory
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

    /**
     * @notice Returns the encoded bytecode for a SmartWallet and owner
     * @param owner The address of the owner of the SmartWallet
     * @return Encoded data of the SmartWallet bytecode and the owner address
     */
    function _getBytecode(address owner) private view returns (bytes memory) {
        bytes memory bytecode = type(SmartWallet).creationCode;

        return abi.encodePacked(bytecode, abi.encode(owner));
    }

    /**
     * @inheritdoc ISmartWalletFactory
     */
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

    /**
     * @notice Creates a new SmartWallet using Salted contract creations / create2
     * @param owner The address of the owner of the SmartWallet
     * @param salt The salt used to deploy the SmartWallet
     */
    function _deploy(address owner, bytes32 salt)
        internal
        returns (address addr)
    {
        //Deployment of the Smart Wallet
        SmartWallet sm = new SmartWallet{salt: salt}(owner);

        //No info is returned, an event is emitted to inform the new deployment
        addr = address(sm);
        emit Deployed(addr, uint256(salt));
    }

    /**
     * @inheritdoc ISmartWalletFactory
     */
    function getSmartWallet(address owner) public returns (SmartWallet) {
        address smartWalletAddress = this.getSmartWalletAddress(owner);
        uint32 size;
        // slither-disable-next-line assembly
        assembly {
            size := extcodesize(smartWalletAddress)
        }

        if (size == 0) {
            this.createUserSmartWallet(owner);
        }
        return SmartWallet(payable(smartWalletAddress));
    }
}
