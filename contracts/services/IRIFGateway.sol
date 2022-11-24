// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./Service.sol";
import { Provider } from "./ServiceData.sol";

interface IRIFGateway {
    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);
    error NonConformity(string nonConformityErrMsg);
    // TODO: check for duplicated _servicesByProvider
    // error DuplicatedService(address service);

    event ServiceAdded(address provider, address service);
    event ValidationRequested(address provider);
    event ServiceValidated(address provider, address service);

    function addService(Service service) external;

    function getServicesAndProviders() external view returns (Service[] memory, Provider[] memory);

    function requestValidation(address provider) external;
}
