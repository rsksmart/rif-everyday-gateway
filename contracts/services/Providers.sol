// SPDX-License-Identifier: MI T
pragma solidity ^0.8.4;

import "./Service.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ServiceTypeManager.sol";

contract Providers is Ownable {
    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);
    error NonConformity(string NonConformityErrMsg);

    mapping(address => Service[]) private _servicesByProvider;
    address[] private _providers;
    uint256 private _totalServices;
    ServiceTypeManager private _serviceTypeManager;

    bytes4 private constant _InterfaceId_ERC165 = 0x01ffc9a7;

    constructor(ServiceTypeManager stm) {
        _serviceTypeManager = stm;
    }

    function addService(Service service) external {
        // Checks that the service provider implements ERC165
        if (!service.supportsInterface(_InterfaceId_ERC165)) {
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

        if (_servicesByProvider[provider].length == 0) {
            _providers.push(provider);
        }

        _servicesByProvider[provider].push(service);
        _totalServices++;
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
}
