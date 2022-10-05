// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/Service.sol";

abstract contract BorrowService is Service, IBorrowService {
    constructor() {
        serviceType = ServiceType.Borrowing;
    }

    function borrow(
        uint256 amount,
        address currency,
        uint256 duration,
        uint256 listingId
    ) public payable virtual;

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) public payable virtual;

    function withdraw() public virtual;

    function currentLiquidity(uint256 index)
        public
        view
        virtual
        returns (uint256 liquidity)
    {
        return listings[index].maxAmount;
    }

    function addLiquidity(uint256 amount, uint256 index)
        public
        virtual
        onlyOwner
    {
        listings[index].maxAmount += amount;
    }

    function removeLiquidity(uint256 amount, uint256 index)
        public
        virtual
        onlyOwner
    {
        _removeLiquidityInternal(amount, index);
    }

    function _removeLiquidityInternal(uint256 amount, uint256 index) internal {
        listings[index].maxAmount -= amount;
    }
}
