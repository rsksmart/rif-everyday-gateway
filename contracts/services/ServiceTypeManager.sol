// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";

import "./IService.sol";

/**
 * @title Service Type Manager
 * @dev Contract for the Service Type Manager contract
 * @author RIF protocols team
 */
contract ServiceTypeManager is Ownable, ERC165Storage {
    /**
     * @notice Allows owner to register a new service type
     * @param newServiceInterfaceId The id of the interface
     */
    function addServiceType(bytes4 newServiceInterfaceId) external onlyOwner {
        super._registerInterface(newServiceInterfaceId);
    }
}
