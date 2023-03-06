// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

// Upgradeability imports
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/* solhint-disable no-empty-blocks */

/**
 * @title RIF Gateway
 * @dev Contract for the RIF Gateway contract
 * @author RIF protocols team
 */
contract RIFGateway is ERC1967Proxy {
    constructor(address _logic, bytes memory _data)
        ERC1967Proxy(_logic, _data)
    {}
}
