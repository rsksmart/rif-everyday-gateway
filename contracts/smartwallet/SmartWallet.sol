// SPDX-License-Identifier:MIT
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IForwarder.sol";
import "./RSKAddrValidator.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * @title SmartWallet
 * @notice SmartWallet is a contract that allows users to execute transactions on behalf of them
 * without having to send ETH to the contract. It also allows users to execute transactions
 * without having to sign all of them with their private key.
 * Based on rif-relay-contracts smartwallet/SmartWallet.sol
 * @author RIF protocols team
 */
contract SmartWallet is IForwarder, ReentrancyGuard {
    using ECDSA for bytes32;

    uint256 public override nonce;
    bytes32 public constant DATA_VERSION_HASH = keccak256("1");
    bytes32 public domainSeparator;

    uint256 private _currentBlockForNonce;

    error InvalidNonce(uint256 nonce);
    error InvalidBlockForNonce(uint256 nonce);
    error InvalidExecutor(address executor);
    error UnexpectedError(bytes data);
    error ReadNoLongerValid();

    constructor(address owner) {
        _setOwner(owner);
        _buildDomainSeparator();
    }

    /**
     * @notice Sets the domainSeparator to the value defined on EIP-712
     */
    function _buildDomainSeparator() internal {
        domainSeparator = _encodedDomainSeparator();
    }

    /**
     * @notice Returns the domain separator for the smart wallet
     * Domain separator is defined on EIP-712
     * https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator
     * @return Encoded domain separator
     */
    function getDomainSeparator() public view returns (bytes32) {
        return _encodedDomainSeparator();
    }

    /**
     * @notice Returns the domain separator for the smart wallet
     * Domain separator is defined on EIP-712
     * https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator
     * @return Encoded domain separator
     */
    function _encodedDomainSeparator() internal view returns (bytes32) {
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

    /**
     * @notice Sets the owner of the smart wallet
     * @dev To avoid re-entrancy attacks by external contracts,
     * we set the variable that controls "is initialized"
     * set this instance as initialized, by storing on the EVM
     * storage the address of the owner of the smart wallet on
     * the slot bytes32(uint256(keccak256('eip1967.proxy.owner')) - 1) = a7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a
     * @param owner The address of the owner of the SmartWallet
     */
    function _setOwner(address owner) private {
        bytes32 ownerCell = keccak256(abi.encodePacked(owner));

        // slither-disable-next-line assembly
        assembly {
            sstore(
                0xa7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a,
                ownerCell
            )
        }
    }

    /**
     * @inheritdoc IForwarder
     */
    function verify(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes calldata sig
    ) external view override {
        _verifySig(suffixData, req, sig);
    }

    /**
     * @notice Returns the address of the owner of the SmartWallet+
     * @dev Loads from EVM storage the slot where the owner is stored
     * slot = bytes32(uint256(keccak256('eip1967.proxy.owner')) - 1) = a7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a
     * @return owner the address of the owner of the SmartWallet
     */
    function _getOwner() private view returns (bytes32 owner) {
        // slither-disable-next-line assembly
        assembly {
            owner := sload(
                0xa7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a
            )
        }
    }

    /**
     * @inheritdoc IForwarder
     */
    // TODO: Add a nested structure to `IForwarder.MetaTransaction` in order to
    function execute(
        IForwarder.MetaTransaction calldata mtx,
        bytes calldata data,
        address to,
        address currency
    ) external payable override returns (bool success, bytes memory ret) {
        (mtx.sig); // This line saves gas TODO: Research why 🤷‍♂️

        _verifyNonce(mtx.req);
        _verifySig(mtx.suffixData, mtx.req, mtx.sig);

        // slither-disable missing-zero-check low-level-calls
        (success, ret) = to.call{value: msg.value}(data);

        //If any balance has been added then transfer it to the owner EOA
        uint256 currentBalance = address(this).balance;
        if (currentBalance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            // slither-disable-next-line unchecked-lowlevel
            payable(mtx.req.from).call{value: currentBalance}("");
        }

        _forwardTokensIfAny(mtx.req.from, currency);
    }

    function _forwardTokensIfAny(address to, address currency)
        internal
        returns (bool success)
    {
        if (currency != address(0)) {
            uint256 currentERC20Balance = IERC20(currency).balanceOf(
                address(this)
            );

            if (currentERC20Balance > 0) {
                success = IERC20(currency).transfer(to, currentERC20Balance);
            }
        }
    }

    /**
     * @notice Returns the value of the current chain ID obtained from the chain ID configuration
     * @return id chainId the chain id
     */
    function _getChainID() private view returns (uint256 id) {
        //slither-disable-next-line assembly
        assembly {
            id := chainid()
        }
    }

    /**
     * @notice Verifies that the nonce is valid
     * @param req the forward request
     */
    function _verifyNonce(ForwardRequest memory req) private {
        //Verify nonce
        if (nonce == req.nonce) {
            // example: current nonce = 4 and req.nonce = 4
            nonce++;
            _currentBlockForNonce = block.number;
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

    /**
     * @notice Verifies that the signature is valid
     * @param suffixData the suffix data
     * @param req the forward request
     * @param sig the signature
     */
    function _verifySig(
        bytes32 suffixData,
        ForwardRequest memory req,
        bytes memory sig
    ) private view {
        // TODO: this can be removes since the signature validation already verifies the req.from
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

    /**
     * @notice Returns the encoded data given the suffix data and the forward request
     * @param suffixData the suffix data
     * @param req the forward request
     * @return encodedData the encoded data
     */
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
