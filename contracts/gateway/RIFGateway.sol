// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

// Upgradeability imports
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title RIF Gateway
 * @dev Contract for the RIF Gateway contract
 * @author RIF protocols team
 */
contract RIFGateway is ERC1967Proxy {
    /* solhint-disable no-empty-blocks */
    constructor(address _logic, bytes memory _data)
        ERC1967Proxy(_logic, _data)
    {}
}
