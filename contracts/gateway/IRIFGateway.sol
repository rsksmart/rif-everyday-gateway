// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../services/Service.sol";
import {Provider} from "../services/ServiceData.sol";

interface IRIFGateway {
    event ServiceAdded(address provider, address service);
    event ValidationRequested(address provider);
    event ServiceValidated(address provider, address service);

    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);
    error NonConformity(string nonConformityErrMsg);
    error DuplicatedService(Service service);
    error InvalidService(Service service);
    error InvalidProvider(address provider);

    function addService(Service service) external;

    function getServicesAndProviders()
        external
        view
        returns (Service[] memory, Provider[] memory);

    function requestValidation(address provider) external;

    function validateProvider(address provider) external;

    function removeService(Service service) external;
}
