// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "./IForwarder.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */
/* solhint-disable avoid-tx-origin */

contract SmartWallet is IForwarder {
    using ECDSA for bytes32;
    uint256 public override nonce;
    uint256 public override blockForNonce;
}
