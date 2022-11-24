// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Service.sol";

interface IRIFGateway {
    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);
    error NonConformity(string nonConformityErrMsg);
    // TODO: check for duplicated _servicesByProvider 
    // error DuplicatedService(address service);

    event ServiceAdded(address provider, address service);
    event ValidationRequested(address provider, address service);
    event ServiceValidated(address provider, address service);

    function addService(Service service) external;

    function getServices() external view returns (Service[] memory);

    function requestValidation(address provider, address service) external;
}
