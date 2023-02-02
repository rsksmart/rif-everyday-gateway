// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "../services/Service.sol";
import {Provider} from "../services/ServiceData.sol";
import "../services/ServiceTypeManager.sol";
import "../access/IGatewayAccessControl.sol";

/**
 * @title RIF Gateway Storage V1
 * @dev Contract for the RIF Gateway contract's storage layout
 * @author RIF protocols team
 */
contract RIFGatewayStorageV1 {
    Provider[] internal _providers;
    mapping(address => uint256) internal _providerIndexes; // indexes from 1, 0 used to verify not duplication
    ServiceTypeManager internal _serviceTypeManager;
    IGatewayAccessControl internal _accessControl;
    Service[] internal _allServices;
    mapping(address => bool) internal _uniqueServices;

    bytes4 internal constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
}
