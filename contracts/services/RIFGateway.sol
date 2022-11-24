// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "./Service.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ServiceTypeManager.sol";
import "./IRIFGateway.sol";
import { Provider } from "./ServiceData.sol";

contract RIFGateway is IRIFGateway, Ownable {
    Provider[] private _providers;
    mapping(address => uint) private _providerIndexes; // indexes from 1, 0 used to verify not duplication
    uint256 private _totalServices;
    ServiceTypeManager private _serviceTypeManager;
    Service[] _allServices;

    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    constructor(ServiceTypeManager stm) {
        _serviceTypeManager = stm;
    }

    function addService(Service service) external {
        // Checks that the service provider implements ERC165
        if (!service.supportsInterface(_INTERFACE_ID_ERC165)) {
            revert NonConformity("Service does not implement ERC165");
        }

        // Checks that the provider adheres to the service interface
        if (!_serviceTypeManager.supportsInterface(service.getServiceType())) {
            revert InvalidServiceImplementation(
                service,
                service.getServiceType()
            );
        }

        // Proceeds to add the provider and service
        address provider = service.owner();
        if (provider == address(0)) revert InvalidProviderAddress(provider);
        uint index = _providerIndexes[provider];
        if (_providerIndexes[provider] == 0) {
            _providers.push(Provider({provider: provider, validated: false}));
            _providerIndexes[provider] = _providers.length;
        }
        // TODO: check for duplicated _servicesByProvider
        // revert DuplicatedService(service);
        _totalServices++;
        _allServices.push(service);
    }

    function getServicesAndProviders() external view returns (Service[] memory, Provider[] memory) {
        return (_allServices, _providers);
    }

    function requestValidation(address provider) external {
        // TODO: Check if the service is already on the RIFGateway
        emit ValidationRequested(provider);
    }

    function validateProvider(address provider) external onlyOwner {
        _providers[_providerIndexes[provider]].validated = true;
    }

    function removeService(Service service) external {
        // TODO: msg.sender must be service owner
        for(uint i = 0; i < _allServices.length; i++) {
            if(_allServices[i] == service) {
                _allServices[i] = _allServices[_allServices.length -1];
                _allServices.pop();
                break;
            }
        }
    }
}
