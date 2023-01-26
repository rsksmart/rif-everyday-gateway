// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Use only for testing purposes
// FIXME: this potentially need to be placed in a separated repo
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC677
 * @dev Creates ERC20 tokens with initial total supply
 * of 1000000000 ether only for testing purposes
 * @author RIF protocols team
 */
contract ERC677 is ERC20 {
    uint256 private constant _TOTAL_SUPPLY = 1000000000 ether;

    constructor(
        address initialAccount,
        uint256 initialBalance,
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {
        _mint(initialAccount, initialBalance);
    }

    /**
     * @notice Returns the total supply of the token
     * @return total supply
     */
    function totalSupply() public pure override returns (uint256) {
        return _TOTAL_SUPPLY;
    }
}
