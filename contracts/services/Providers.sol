// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Service.sol";
import "./IServiceData.sol";

contract Providers is IServiceData, Ownable {
    error InvalidProviderAddress(address provider);

    mapping(address => Service[]) private _servicesByProvider;
    mapping(address => Service[]) private _pendingServices;
    address[] private _providers;
    address[] private _pendingProviders;
    uint256 private _totalServices;

    function addService(Service service) external {
        address provider = service.owner();
        if (provider == address(0)) revert InvalidProviderAddress(provider);
        if (!_isOnAddressArray(_pendingProviders, provider))
            _pendingProviders.push(provider);
        _pendingServices[provider].push(service);
        _totalServices++;
    }

    function validate(bool approved, Service service) external onlyOwner {
        address provider = service.owner();
        if (approved) {
            if (!_isOnAddressArray(_providers, provider))
                _providers.push(provider);
            _servicesByProvider[provider].push(service);
        }
        //TODO: else clean _pendingProviders & _pendingServices
    }

    function getServices() external view returns (Service[] memory) {
        Service[] memory servicesByType = new Service[](_totalServices);
        for (uint256 i = 0; i < _providers.length; i++) {
            Service[] memory services = _servicesByProvider[_providers[i]];
            for (uint256 j = 0; j < services.length; j++) {
                servicesByType[servicesByType.length - 1] = services[j];
            }
        }
        return servicesByType;
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
