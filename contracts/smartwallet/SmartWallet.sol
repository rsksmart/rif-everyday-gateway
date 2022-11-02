// SPDX-License-Identifier:MIT
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IForwarder.sol";
import "./RSKAddrValidator.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWallet is IForwarder {
    using ECDSA for bytes32;

    error InvalidNonce(uint256 nonce);
    error InvalidBlockForNonce(uint256 nonce);
    error InvalidExecutor(address executor);
    error UnexpectedError(bytes data);

    uint256 public override nonce;
    bytes32 public constant DATA_VERSION_HASH = keccak256("1");
    bytes32 public domainSeparator;

    uint256 private _currentBlockForNonce;

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
        address to,
        address currency,
        uint256 amount
    ) external payable override returns (bool success, bytes memory ret) {
        (sig); // This is line saves gas TODO: Research why this saves gas 🤷‍♂️

        _verifyNonce(req);
        _verifySig(suffixData, req, sig);

        if (currency == address(0)) {
            (success, ret) = to.call{value: msg.value}(data);

            //If any balance has been added then transfer it to the owner EOA
            uint256 balanceToTransfer = address(this).balance;
            if (balanceToTransfer > 0) {
                //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
                payable(req.from).transfer(balanceToTransfer);
            }
        } else {
            if (amount > 0) {
                uint256 balance = ERC20(currency).balanceOf(req.from);
                if (balance >= amount) {
                    ERC20(currency).transferFrom(
                        req.from,
                        address(this),
                        amount
                    );
                    ERC20(currency).approve(address(to), amount);
                }
            }
            uint256 balanceToTransfer = ERC20(currency).balanceOf(
                address(this)
            );
            if (balanceToTransfer > 0) {
                ERC20(currency).transfer(req.from, balanceToTransfer);
            }
            success = true;
        }
    }

    function read(
        //        bytes32 suffixData,
        //        ForwardRequest memory req,
        //        bytes calldata sig,
        address targetContract,
        bytes calldata functionToCall
    ) external view returns (bytes memory) {
        //        _verifyNonce(req);
        //        _verifySig(suffixData, req, sig);
        (bool success, bytes memory data) = targetContract.staticcall(
            functionToCall
        );

        if (!success) {
            revert UnexpectedError(data);
        }

        return data;
    }

    function _getChainID() private view returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function _verifyNonce(ForwardRequest memory req) private {
        //Verify nonce
        if (nonce == req.nonce) {
            // example: current nonce = 4 and req.nonce = 4
            nonce++;
        } else if (nonce > req.nonce && _currentBlockForNonce != block.number) {
            // example: current nonce = 5 and req.nonce = 4
            // and we are not in the same transaction
            revert InvalidBlockForNonce(req.nonce);
        } else if (nonce < req.nonce) {
            // example: current nonce = 5 and req.nonce = 10, must increment by one in each
            // transaction
            revert InvalidNonce(req.nonce);
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

        //Verify executor
        if (req.executor != msg.sender) {
            revert InvalidExecutor(msg.sender);
        }

        // Verify current block number
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
                abi.encode(req.from, req.nonce, req.executor)
                //suffixData
            );
    }

    /* solhint-disable no-empty-blocks */
    receive() external payable {}
}
