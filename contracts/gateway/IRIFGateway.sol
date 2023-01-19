// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../services/Service.sol";
import {Provider} from "../services/ServiceData.sol";

/**
 * @title RIF Gateway interface
 * @author RIF protocols team
 */
interface IRIFGateway {
    /**
     * @notice Emitted when a new service is registered
     * @param provider The address of the provider of the service
     * @param service The address of the service
     */
    event ServiceAdded(address provider, address service);
    /**
     * @notice Emitted when a service is removed
     * @param provider The address of the provider of the service
     * @param service The address of the service
     */
    event ServiceRemoved(address provider, address service);
    /**
     * @notice Emitted when a service provider validation is requested
     * @param provider The address of the provider of the service
     */
    event ValidationRequested(address provider);
    /**
     * @notice Emitted when a service provider is validated
     * @param provider The address of the provider of the service
     */
    event ProviderValidated(address provider);

    error InvalidProviderAddress(address provider);
    error InvalidServiceImplementation(Service service, bytes4 serviceType);
    error NonConformity(string nonConformityErrMsg);
    error DuplicatedService(Service service);
    error InvalidService(Service service);
    error ProviderAlreadyValidated(address provider);
    error ValidationNotRequested(address provider);

    /**
     * @notice Adds a new service to the gateway
     * @dev Checks if the service adheres to the service interface (EIP-165)
     * and adds the provider if it is the first service
     * @param service The address of the service to be added
     */
    function addService(Service service) external;

    /**
     * @notice Returns services and providers registered on the gateway
     * @return services array of services registered on the gateway
     * @return providers array of providers registered on the gateway
     */
    function getServicesAndProviders()
        external
        view
        returns (Service[] memory, Provider[] memory);

    /**
     * @notice Request the validation of a service provider
     * @param provider The address of the service provider to be validated
     */
    function requestValidation(address provider) external;

    /**
     * @notice Validates a service provider
     * @param provider The address of the provider to be validated
     */
    function validateProvider(address provider) external;

    /**
     * @notice Removes a service from the gateway
     * @param service The address of the service to be removed
     */
    function removeService(Service service) external;
}
