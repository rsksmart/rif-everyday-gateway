// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC165.sol";
import "./IService.sol";

contract ServiceTypeManager is Ownable {
    struct ServiceType {
        string name;
    }

    mapping(bytes4 => ServiceType) public serviceTypes;
    uint256 public serviceTypeCount;

    function addServiceType(string memory name, bytes4 interfaceId)
        external
        onlyOwner
    {
        serviceTypeCount++;
        serviceTypes[interfaceId] = ServiceType(name);
    }

    function supportsService(IService service) public view returns (bool) {
        //checks if the interfaceId(unique for every service type interface) is
        //registered and double checks
        //that it actually implements erc165
        return
            bytes(serviceTypes[service.getServiceType()].name).length > 0 &&
            service.supportsInterface(service.getServiceType());
    }
}
