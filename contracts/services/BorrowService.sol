// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/services/Service.sol";

abstract contract BorrowService is Service {
    mapping(address => mapping(uint256 => BorrowServiceListing))
        public listings;

    mapping(address => uint256) private _counters;

    struct BorrowServiceListing {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 maxDuration;
        uint256 interestRate;
        uint256 loanToValue;
        address loanToValueTokenAddr;
        address currency;
    }

    event Borrow(
        uint256 indexed index,
        address indexed borrower,
        address indexed currency,
        uint256 amount,
        uint256 duration
    );

    event Pay(
        uint256 indexed index,
        address indexed borrower,
        address indexed currency,
        uint256 amount
    );

    event ListingCreated(
        uint256 indexed index,
        address indexed currency,
        uint256 indexed interestRate
    );

    event ListingRemoved(uint256 indexed index, address indexed currency);

    constructor() {
        serviceType = ServiceType.Borrowing;
    }

    function borrow(
        uint256 amount,
        address currency,
        uint256 index,
        uint256 duration
    ) public payable virtual;

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) public payable virtual;

    function currentLiquidity(address currency, uint256 index)
        public
        view
        virtual
        returns (uint256 liquidity)
    {
        return listings[currency][index].maxAmount;
    }

    function addLiquidity(
        uint256 amount,
        address currency,
        uint256 index
    ) public virtual onlyOwner {
        listings[currency][index].maxAmount += amount;
    }

    function removeLiquidity(
        uint256 amount,
        address currency,
        uint256 index
    ) public virtual onlyOwner {
        _removeLiquidityInternal(amount, currency, index);
    }

    function _removeLiquidityInternal(
        uint256 amount,
        address currency,
        uint256 index
    ) internal {
        listings[currency][index].maxAmount -= amount;
    }

    function addListing(BorrowServiceListing memory listing)
        public
        virtual
        onlyOwner
        returns (uint256 index)
    {
        listings[listing.currency][_counters[listing.currency]] = listing;

        index = _counters[listing.currency]++;

        emit ListingCreated(index, listing.currency, listing.interestRate);
    }

    function removeListing(uint256 index, address currency)
        public
        virtual
        onlyOwner
    {
        uint256 n = _counters[currency];
        for (uint256 i = index + 1; i < n; i++) {
            listings[currency][index] = listings[currency][i];
        }
        delete listings[currency][n];

        _counters[currency]--;

        emit ListingRemoved(index, currency);
    }

    function getListing(uint256 index, address currency)
        public
        view
        virtual
        returns (BorrowServiceListing memory listing)
    {
        return listings[currency][index];
    }

    function getListingsCount(address currency)
        public
        view
        virtual
        returns (uint256 count)
    {
        return _counters[currency];
    }
}
