// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "./ISmartWalletFactory.sol";
import "./SmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWalletFactory is ISmartWalletFactory {
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
        addr = address(new SmartWallet{salt: salt}(owner));
        //No info is returned, an event is emitted to inform the new deployment
        emit Deployed(addr, uint256(salt));
    }
}
