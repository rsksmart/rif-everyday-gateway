// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IOwnable.sol";

abstract contract InitializableOwnable is IOwnable {
    address private _owner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        _owner = address(this);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function initialize() public virtual {
        require(_owner != address(this), "Ownable: already initialized");

        _owner = msg.sender;
    }

    function owner() public view override returns (address) {
        return _owner;
    }

    function _checkOwner() private view {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
    }

    function transferOwnership(address newOwner)
        public
        virtual
        override
        onlyOwner
    {
        require(newOwner != address(0), "Ownable: new owner is address zero");

        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
