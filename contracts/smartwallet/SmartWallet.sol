// SPDX-License-Identifier:MIT
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./IForwarder.sol";
import "./RSKAddrValidator.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWallet is IForwarder {
    using ECDSA for bytes32;

    uint256 public override nonce;
    bytes32 public constant DATA_VERSION_HASH = keccak256("1");
    bytes32 public domainSeparator;

    constructor(address owner) {
        _setOwner(owner);
        _buildDomainSeparator();
    }

    function _buildDomainSeparator() internal {
        domainSeparator = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ), //hex"8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f",
                keccak256("RSK RIF GATEWAY"), //DOMAIN_NAME hex"d41b7f69f4d7734774d21b5548d74704ad02f9f1545db63927a1d58479c576c8"
                DATA_VERSION_HASH,
                _getChainID(),
                address(this)
            )
        );
    }

    function getDomainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ), //hex"8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f",
                    keccak256("RSK RIF GATEWAY"), //DOMAIN_NAME hex"d41b7f69f4d7734774d21b5548d74704ad02f9f1545db63927a1d58479c576c8"
                    DATA_VERSION_HASH,
                    _getChainID(),
                    address(this)
                )
            );
    }

    function _setOwner(address owner) private {
        //To avoid re-entrancy attacks by external contracts, the first thing we do is set
        //the variable that controls "is initialized"
        //We set this instance as initialized, by
        //storing the logic address
        //Set the owner of this Smart Wallet
        //slot for owner = bytes32(uint256(keccak256('eip1967.proxy.owner')) - 1) = a7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a
        bytes32 ownerCell = keccak256(abi.encodePacked(owner));

        assembly {
            sstore(
                0xa7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a,
                ownerCell
            )
        }
    }

    function verify(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes calldata sig
    ) external view override {
        _verifySig(suffixData, req, sig);
    }

    function _getOwner() private view returns (bytes32 owner) {
        assembly {
            owner := sload(
                0xa7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a
            )
        }
    }

    function execute(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes calldata sig,
        bytes calldata data,
        address to
    ) external payable override returns (bool success, bytes memory ret) {
        (sig); // This is line saves gas TODO: Research why this saves gas 🤷‍♂️

        _verifySig(suffixData, req, sig);
        nonce++;

        (success, ret) = to.call{value: msg.value}(data);

        //If any balance has been added then trasfer it to the owner EOA
        uint256 balanceToTransfer = address(this).balance;
        if (balanceToTransfer > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(req.from).transfer(balanceToTransfer);
        }
    }

    function _getChainID() private view returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function _verifySig(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes memory sig
    ) private view {
        //Verify Owner
        require(
            _getOwner() == keccak256(abi.encodePacked(req.from)),
            "Not the owner of the SmartWallet"
        );

        //Verify nonce
        require(nonce == req.nonce, "nonce mismatch");

        require(
            RSKAddrValidator.safeEquals(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        domainSeparator,
                        keccak256(_getEncoded(suffixData, req))
                    )
                ).recover(sig),
                req.from
            ),
            "Signature mismatch"
        );
    }

    function recov(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes memory sig
    ) public view returns (address) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    domainSeparator,
                    keccak256(_getEncoded(suffixData, req))
                )
            ).recover(sig);
    }

    function _getEncoded(bytes32 suffixData, ForwardRequest memory req)
        private
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                keccak256(
                    "ForwardRequest(address from,uint256 nonce,address executor)"
                ), //requestTypeHash,
                abi.encode(req.from, req.nonce, req.executor),
                suffixData
            );
    }

    /* solhint-disable no-empty-blocks */
    receive() external payable {}
}
