// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../gateway/IRIFGateway.sol";

contract FeeManagerStorageV1 {
    uint256 internal immutable _fixedOwnerFee = 1 gwei;
    uint256 internal immutable _fixedBeneficiaryFee = 1 gwei;
    address internal _feesOwner;
    IRIFGateway internal _rifGateway;

    // Applies to service providers
    // debtor => beneficiary address
    mapping(address => address[]) internal _creditors;

    // Applies to amount of debt for keccak256(abi.encodePacked(debtor,beneficiary))
    mapping(bytes32 => uint256) internal _amounts;

    // Funds for each account
    mapping(address => uint256) internal _funds;
}
