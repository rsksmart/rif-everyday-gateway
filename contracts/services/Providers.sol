// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "./Service.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ServiceTypeManager.sol";

contract Providers is Ownable {
    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);

    mapping(address => Service[]) private _servicesByProvider;
    mapping(address => Service[]) private _pendingServicesByProvider;
    address[] private _providers;
    address[] private _pendingProviders;
    uint256 private _totalServices;
    ServiceTypeManager private _serviceTypeManager;

    constructor(ServiceTypeManager stm) {
        _serviceTypeManager = stm;
    }

    function addService(Service service) external {
        if (!_serviceTypeManager.supportsService(service)) {
            revert InvalidServiceImplementation(
                service,
                service.getServiceType()
            );
        }

        address provider = service.owner();
        if (provider == address(0)) revert InvalidProviderAddress(provider);
        if (!_isOnAddressArray(_pendingProviders, provider))
            _pendingProviders.push(provider);
        _pendingServicesByProvider[provider].push(service);
        _totalServices++;
    }

    function validate(bool approved, Service service) external onlyOwner {
        address provider = service.owner();
        if (approved) {
            if (!_isOnAddressArray(_providers, provider)) {
                _providers.push(provider);
            }
            _servicesByProvider[provider].push(service);
        }
        //TODO: else clean _pendingProviders & _pendingServices
    }

    function getServices() external view returns (Service[] memory) {
        Service[] memory allServices = new Service[](_totalServices);
        uint256 counter = 0;
        for (uint256 i = 0; i < _providers.length; i++) {
            Service[] memory servicesByProvider = _servicesByProvider[
                _providers[i]
            ];
            for (uint256 j = 0; j < servicesByProvider.length; j++) {
                allServices[counter] = servicesByProvider[j];
                counter++;
            }
        }
        return allServices;
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
