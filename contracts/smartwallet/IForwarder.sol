// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

/**
 * @title IForwarder
 * @dev Interface for the Forwarder contract
 * Based on rif-relay-contracts interfaces/IForwarder.sol
 * @author RIF protocols team
 */
interface IForwarder {
    struct ForwardRequest {
        address from;
        uint256 nonce;
        address executor;
    }

    struct MetaTransaction {
        ForwardRequest req;
        bytes sig;
    }

    /**
     * @notice Returns the nonce of the user transactions
     * @return nonce The nonce of the user transactions
     */
    function nonce() external view returns (uint256);

    /**
     * @notice verify the transaction would execute.
     * validate the signature and the nonce of the request.
     * revert if either signature or nonce are incorrect.
     * @param forwardRequest the request to verify
     * @param signature the signature to verify
     */
    function verify(
        ForwardRequest calldata forwardRequest,
        bytes calldata signature
    ) external view;

    /**
     * @notice Executes a transaction on behalf of the owner of the SmartWallet
     * @param mtx signed meta tx to be executed.
     * @param data - function call data
     * @param to - target contract to call
     *
     * the transaction is verified, and then executed.
     * the success and response (ret) of "call" are returned.
     * This method would return only verification errors. target errors
     * so it doesn't revert when a error happens when on the callee
     * are reported using the returned "success" and ret string
     */
    function execute(
        IForwarder.MetaTransaction calldata mtx,
        bytes calldata data,
        address to
    ) external payable returns (bool success, bytes memory ret);

    /**
     * @notice Executes a transaction on behalf of the owner of the SmartWallet
     *         and forwards all ERC20 tokens through `currency` contract to owner
     *         of the Smart Wallet. (EOA, which is basically the signer `mtx.req.from`)
     * @param mtx signed meta tx to be executed.
     * @param data - function call data
     * @param to - target contract to call
     * @param currency - currency exchanged in this tx
     *
     * the transaction is verified, and then executed.
     * the success and response (ret) of "call" are returned.
     * This method would return only verification errors. target errors
     * so it doesn't revert when a error happens when on the callee
     * are reported using the returned "success" and ret string
     */
    function executeAndForwardTokens(
        IForwarder.MetaTransaction calldata mtx,
        bytes calldata data,
        address to,
        address currency
    ) external payable returns (bool success, bytes memory ret);
}
