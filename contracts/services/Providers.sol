// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Service.sol";
import "./IServiceData.sol";
import "hardhat/console.sol";

contract Providers is IServiceData, Ownable {
    error InvalidProviderAddress(address provider);

    mapping(address => Service[]) _servicesByProvider;
    mapping(address => Service[]) _pendingServices;
    address[] _providers;
    address[] _pendingProviders;

    function addService(Service service) external {
        address provider = service.owner();
        if (provider == address(0)) revert InvalidProviderAddress(provider);
        if (!_isOnAddressArray(_pendingProviders, provider))
            _pendingProviders.push(provider);
        _pendingServices[provider].push(service);
    }

    function validate(bool approved, Service service) external onlyOwner {
        address provider = service.owner();
        if (approved) {
            if (!_isOnAddressArray(_providers, provider))
                _providers[_providers.length] = provider;
            _servicesByProvider[provider].push(service);
        }
        //TODO: else clean _pendingProviders & _pendingServices
    }

    function getServices(ServiceType serviceType)
        external
        view
        returns (Service[] memory)
    {
        Service[] memory servicesByType;
        for (uint256 i = 0; i < _providers.length; i++) {
            Service[] memory services = _servicesByProvider[_providers[i]];
            for (uint256 j = 0; j < services.length; j++) {
                if (services[j].serviceType() == serviceType)
                    servicesByType[servicesByType.length] = services[j];
            }
        }
        return servicesByType;
    }

    function getPendingServices(ServiceType serviceType)
        external
        view
        returns (Service[] memory)
    {
        Service[] memory pendingServicesByType;
        for (uint256 i = 0; i < _pendingProviders.length; i++) {
            Service[] memory services = _pendingServices[_pendingProviders[i]];
            for (uint256 j = 0; j < services.length; j++) {
                if (services[j].serviceType() == serviceType)
                    pendingServicesByType[
                        pendingServicesByType.length
                    ] = services[j];
            }
        }
        return pendingServicesByType;
    }

    function _isOnAddressArray(address[] memory arr, address add)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == add) return true;
        }
        return false;
    }
}
