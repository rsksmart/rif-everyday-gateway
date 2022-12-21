// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;
pragma experimental ABIEncoderV2;

interface IForwarder {
    struct ForwardRequest {
        address from;
        uint256 nonce;
        address executor;
    }

    struct MetaTransaction {
        bytes32 suffixData;
        ForwardRequest req;
        bytes sig;
    }

    function nonce() external view returns (uint256);

    /**
     * verify the transaction would execute.
     * validate the signature and the nonce of the request.
     * revert if either signature or nonce are incorrect.
     */
    function verify(
        bytes32 suffixData,
        ForwardRequest calldata forwardRequest,
        bytes calldata signature
    ) external view;

    /**
     * execute a transaction
     * @param forwardRequest - all transaction parameters
     * @param suffixData - the extension data used when signing this request.
     * @param signature - signature to validate.
     * @param data - function call data
     * @param to - target contract to call
     *
     * the transaction is verified, and then executed.
     * the success and ret of "call" are returned.
     * This method would revert only verification errors. target errors
     * are reported using the returned "success" and ret string
     */
    function execute(
        bytes32 suffixData,
        ForwardRequest memory forwardRequest,
        bytes calldata signature,
        bytes calldata data,
        address to,
        address currency
    ) external payable returns (bool success, bytes memory ret);
}
