// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IRIFGateway.sol";
import "./SubscriptionReporter.sol";
import {Provider} from "../services/ServiceData.sol";
import "../services/Service.sol";
import "../services/ServiceTypeManager.sol";

contract RIFGateway is Ownable, SubscriptionReporter, IRIFGateway {
    Provider[] private _providers;
    mapping(address => uint256) private _providerIndexes; // indexes from 1, 0 used to verify not duplication
    ServiceTypeManager private _serviceTypeManager;
    Service[] private _allServices;
    mapping(address => bool) private _uniqueServices;

    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;

    constructor(ServiceTypeManager stm) {
        _serviceTypeManager = stm;
    }

    function addService(Service service) external {
        if (_uniqueServices[address(service)])
            revert DuplicatedService(service);
        // Checks that the service provider implements ERC165
        if (!service.supportsInterface(_INTERFACE_ID_ERC165)) {
            revert NonConformity("Service does not implement ERC165");
        }

        // Checks that the provider adheres to the service interface
        if (!_serviceTypeManager.supportsInterface(service.serviceType())) {
            revert InvalidServiceImplementation(service, service.serviceType());
        }

        // Proceeds to add the provider and service
        address provider = service.owner();
        if (provider == address(0)) revert InvalidProviderAddress(provider);
        if (_providerIndexes[provider] == 0) {
            _providers.push(Provider({provider: provider, validated: false}));
            _providerIndexes[provider] = _providers.length;
        }
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
    }

    function validateProvider(address provider) external override onlyOwner {
        if (_providerIndexes[provider] == 0) revert InvalidProvider(provider);
        _providers[_providerIndexes[provider] - 1].validated = true;
    }

    function removeService(Service service) external override {
        if (msg.sender != service.owner())
            revert InvalidProviderAddress(msg.sender);
        if (!_uniqueServices[address(service)]) revert InvalidService(service);
        uint256 upperIndex = _allServices.length - 1;
        for (
            uint256 lowerIndex = 0;
            lowerIndex <= _allServices.length / 2;
            lowerIndex++
        ) {
            if (_allServices[lowerIndex] == service) {
                _allServices[lowerIndex] = _allServices[
                    _allServices.length - 1
                ];
                _allServices.pop();
                _uniqueServices[address(service)] = false;
                break;
            }
            if (_allServices[upperIndex] == service) {
                _allServices[upperIndex] = _allServices[
                    _allServices.length - 1
                ];
                _allServices.pop();
                _uniqueServices[address(service)] = false;
                break;
            }
            upperIndex--;
        }
    }

    function subscribe(
        address subscriber,
        address service,
        uint256 listingId,
        address wallet
    ) public override {
        if (!_uniqueServices[address(service)])
            revert InvalidService(Service(service));

        super.subscribe(subscriber, service, listingId, wallet);
    }
}
