// SPDX-License-Identifier:MIT
pragma solidity ^0.8.16;

/**
 * @title RSKAddrValidator
 * @dev RSKAddrValidator validates RSK addresses
 * Based on rif-relay-contracts utils/RSKAddrValidator.sol
 * @author RIF protocols team
 */
library RSKAddrValidator {
    /*
     * @notice Checks if the address is not zero
     * @param addr it is an address to check that it does not originates from
     * signing with PK = ZERO. RSK has a small difference in which @ZERO_PK_ADDR is
     * also an address from PK = ZERO. So we check for both of them.
     */
    function checkPKNotZero(address addr) internal pure returns (bool) {
        return (addr != 0xdcc703c0E500B653Ca82273B7BFAd8045D85a470 &&
            addr != address(0));
    }

    /*
     * @notice Safely compares two addresses, checking they do not originate from
     * a zero private key
     * @param addr1 first address to compare
     * @param addr2 second address to compare
     * @return true if both addresses are different from PK = ZERO
     */
    function safeEquals(address addr1, address addr2)
        internal
        pure
        returns (bool)
    {
        return (addr1 == addr2 &&
            addr1 != 0xdcc703c0E500B653Ca82273B7BFAd8045D85a470 &&
            addr1 != address(0));
    }
}
