// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

abstract contract InitializableOwnable {
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

    function initialize() public {
        require(_owner == address(this), "Ownable: already initialized");

        _owner = msg.sender;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function _checkOwner() private view {
        require(_owner == msg.sender, "Ownable: caller is not the owner");
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is address zero");

        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
