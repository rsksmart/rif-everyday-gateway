// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "contracts/Services/Service.sol";

abstract contract LendingService is Service {
    event Lend(address indexed lender, address currency, uint256 amount);
    event Withdraw(
        address indexed withdrawer,
        address currency,
        uint256 amount
    );
    event ListingCreated(address indexed currency, uint256 indexed listingId);

    enum PayBackOption {
        day,
        week,
        month,
        year
    }

    struct LendingServiceListing {
        uint256 id;
        uint256 minDuration;
        uint256 maxDuration;
        address currency;
        PayBackOption payBackOption;
        uint256 rewardRate;
    }

    mapping(address => mapping(uint256 => LendingServiceListing))
        public listings;

    uint256 private _listingCounter;

    constructor() {
        serviceType = ServiceType.Lending;
    }

    function lend(uint256 duration, PayBackOption payBackOption)
        public
        payable
        virtual;

    function withdraw() public virtual;

    function getBalance() public virtual returns (uint256);

    function addListing(
        uint256 minDuration,
        uint256 maxDuration,
        address currency,
        PayBackOption payBackOption,
        uint256 rewardRate
    ) public onlyOwner returns (uint256) {
        uint256 listingId = _listingCounter + 1;
        listings[currency][listingId] = LendingServiceListing(
            listingId,
            minDuration,
            maxDuration,
            currency,
            payBackOption,
            rewardRate
        );

        emit ListingCreated(currency, listingId);

        return listingId;
    }

    function removeListing(address currency, uint256 listingId)
        public
        onlyOwner
    {
        delete listings[currency][listingId];
    }

    function getListing(address currency, uint256 listingId)
        public
        view
        returns (LendingServiceListing memory)
    {
        return listings[currency][listingId];
    }

    function getListingCount() public view returns (uint256) {
        return _listingCounter;
    }

    function update(address currency, LendingServiceListing memory listing)
        public
    {
        listings[currency][listing.id] = listing;
    }
}
