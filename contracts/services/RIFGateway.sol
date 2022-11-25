// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "./Service.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ServiceTypeManager.sol";
import "./IRIFGateway.sol";
import {Provider} from "./ServiceData.sol";

contract RIFGateway is IRIFGateway, Ownable {
    Provider[] private _providers;
    mapping(address => uint256) private _providerIndexes; // indexes from 1, 0 used to verify not duplication
    ServiceTypeManager private _serviceTypeManager;
    Service[] private _allServices;
    mapping(address => bool) _uniqueServices;

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
        uint256 index = _providerIndexes[provider];
        if (_providerIndexes[provider] == 0) {
            _providers.push(Provider({provider: provider, validated: false}));
            _providerIndexes[provider] = _providers.length;
        }
        if (_uniqueServices[address(service)])
            revert DuplicatedService(service);
        _allServices.push(service);
        _uniqueServices[address(service)] = true;
    }

    function getServicesAndProviders()
        external
        view
        returns (Service[] memory, Provider[] memory)
    {
        return (_allServices, _providers);
    }

    function requestValidation(address provider) external override {
        if (_providerIndexes[provider] == 0) revert InvalidProvider(provider);
        if (!_providers[_providerIndexes[provider] - 1].validated)
            emit ValidationRequested(provider);
        emit ValidationRequested(provider);
    }

    function validateProvider(address provider) external override onlyOwner {
        if (_providerIndexes[provider] == 0) revert InvalidProvider(provider);
        _providers[_providerIndexes[provider] - 1].validated = true;
    }

    function removeService(Service service) external override {
        if (msg.sender != service.owner())
            revert InvalidProviderAddress(msg.sender);
        for (uint256 i = 0; i < _allServices.length; i++) {
            if (_allServices[i] == service) {
                _allServices[i] = _allServices[_allServices.length - 1];
                _allServices.pop();
                break;
            }
        }
    }
}
