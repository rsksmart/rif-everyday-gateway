// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IOwnable.sol";

/**
 * @title InitializableOwnable
 * @notice Custom Ownable contract with an initializer.
 * @author RIF protocols team
 */
abstract contract InitializableOwnable is IOwnable {
    bool private _initialized;
    address private _owner;
    uint256[10] private __gap;

    /**
     * @dev Emitted when the owner is changed.
     * @param previousOwner The address of the previous owner.
     * @param newOwner The address of the new owner.
     */
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @notice Reverts with "Ownable: caller is not the owner"
     * if the sender is not the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @notice Initialize the contract setting the deployer as the initial owner.
     * Reverts with "Ownable: already initialized" if the contract is already initialized.
     */
    function initialize() public virtual {
        require(!_initialized, "Ownable: already initialized");

        _initialized = true;
        _owner = msg.sender;
    }

    /**
     * @inheritdoc IOwnable
     */
    function owner() public view override returns (address) {
        return _owner;
    }

    /**
     * @notice Reverts with "Ownable: caller is not the owner"
     * if the sender is not the owner.
     */
    function _checkOwner() private view {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
    }

    /**
     * @inheritdoc IOwnable
     */
    function transferOwnership(address newOwner)
        public
        virtual
        override
        onlyOwner
    {
        require(newOwner != address(0), "Ownable: new owner not set");

        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
