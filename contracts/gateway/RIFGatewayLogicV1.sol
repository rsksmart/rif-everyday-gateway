// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "./RIFGatewayStorageV1.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IRIFGateway.sol";
import "./SubscriptionReporter.sol";
import {Provider} from "../services/ServiceData.sol";
import "../services/Service.sol";
import "../services/ServiceTypeManager.sol";
import "../access/IGatewayAccessControl.sol";
import "../access/InitializableOwnable.sol";

/* solhint-disable no-empty-blocks, avoid-low-level-calls */

/**
 * @title RIF Gateway Logic V1
 * @dev Contract for the RIF Gateway contract's logic
 * @author RIF protocols team
 */
contract RIFGatewayLogicV1 is
    IRIFGateway,
    UUPSUpgradeable,
    InitializableOwnable,
    SubscriptionReporter,
    RIFGatewayStorageV1
{
    /**
     * @inheritdoc UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    /**
     * @notice Initializes the contract and sets the initial values
     * for Gateway Access Control, Service Type Manager and Fee Manager.
     * @param serviceTypeManagerAddr Address of the Service Type Manager
     * @param gatewayAccessControlAddr Address of the Gateway Access Control
     * @param feeManagerAddr Address of the Fee Manager
     */
    function initialize(
        address serviceTypeManagerAddr,
        address gatewayAccessControlAddr,
        address feeManagerAddr
    ) public {
        InitializableOwnable.initialize();
        SubscriptionReporter.initialize(feeManagerAddr);

        _serviceTypeManager = ServiceTypeManager(serviceTypeManagerAddr);
        _accessControl = IGatewayAccessControl(gatewayAccessControlAddr);
    }

    /**
     * @inheritdoc IRIFGateway
     */
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
        _addProviderIfNotExists(provider);
        _allServices.push(service);
        _uniqueServices[address(service)] = true;
    }

    /**
     * @inheritdoc IRIFGateway
     */
    function getServicesAndProviders()
        external
        view
        returns (Service[] memory, Provider[] memory)
    {
        return (_allServices, _providers);
    }

    /**
     * @notice Adds a provider if it does not exist
     * @param provider Address of the provider
     */
    function _addProviderIfNotExists(address provider) internal {
        if (_providerIndexes[provider] == 0) {
            _providers.push(Provider({provider: provider, validated: false}));
            _providerIndexes[provider] = _providers.length;
        }
    }

    /**
     * @notice Checks if the provider is already validated
     * @param provider Address of the provider
     * @dev Reverts if the provider is already validated
     */
    function _checkIfProviderIsAlreadyValidated(address provider)
        internal
        view
    {
        if (_providers[_providerIndexes[provider] - 1].validated) {
            revert ProviderAlreadyValidated(provider);
        }
    }

    /**
     * @inheritdoc IRIFGateway
     */
    function requestValidation(address provider) external override {
        _addProviderIfNotExists(provider);
        _checkIfProviderIsAlreadyValidated(provider);

        emit ValidationRequested(provider);
    }

    /**
     * @inheritdoc IRIFGateway
     */
    function validateProvider(address provider) external override {
        if (_providerIndexes[provider] == 0)
            revert ValidationNotRequested(provider);
        _checkIfProviderIsAlreadyValidated(provider);

        _providers[_providerIndexes[provider] - 1].validated = true;

        emit ProviderValidated(provider);
    }

    /**
     * @inheritdoc IRIFGateway
     */
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
                // slither-disable-next-line costly-loop
                _allServices.pop();
                _uniqueServices[address(service)] = false;
                break;
            }
            if (_allServices[upperIndex] == service) {
                _allServices[upperIndex] = _allServices[
                    _allServices.length - 1
                ];
                // slither-disable-next-line costly-loop
                _allServices.pop();
                _uniqueServices[address(service)] = false;
                break;
            }
            upperIndex--;
        }

        emit ServiceRemoved(service.owner(), address(service));
    }

    /**
     * @inheritdoc ISubscriptionReporter
     */
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

    /**
     * @inheritdoc IRIFGateway
     */
    function getAccessControl()
        public
        view
        override
        returns (IGatewayAccessControl)
    {
        return _accessControl;
    }
}
