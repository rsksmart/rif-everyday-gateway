// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "../userIdentity/UserIdentityFactory.sol";
import "../userIdentity/UserIdentity.sol";

contract TropykusBorrowingService is BorrowService {
    error InvalidCollateralAmount(uint256 amount, uint256 expectedAmount);

    address private _comptroller;
    address private _oracle;
    address private _crbtc;
    address private _cdoc;
    UserIdentityFactory private _userIdentityFactory;

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    constructor(
        UserIdentityFactory userIdentityFactory,
        TropykusContracts memory contracts
    ) {
        _comptroller = contracts.comptroller;
        _oracle = contracts.oracle;
        _crbtc = contracts.crbtc;
        _cdoc = contracts.cdoc;
        _userIdentityFactory = userIdentityFactory;
    }

    function borrow(
        uint256 amount,
        address currency,
        uint256 index,
        uint256 duration
    ) public payable override {
        require(amount > 0, "Non zero borrows");
        require(msg.value > 0, "Non zero collateral");

        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        uint256 amountToLend = calculateAmountToLend(amount);
        if (msg.value < amountToLend)
            revert InvalidCollateralAmount(msg.value, amountToLend);

        identity.send{value: msg.value}(
            address(_crbtc),
            abi.encodeWithSignature("mint()")
        );

        address[] memory markets = new address[](1);
        markets[0] = address(_crbtc);

        identity.send(
            address(_comptroller),
            abi.encodeWithSignature("enterMarkets(address[])", markets)
        );

        identity.retrieveTokens(
            address(_cdoc),
            abi.encodeWithSignature("borrow(uint256)", amount),
            currency
        );

        emit Borrow(index, msg.sender, currency, amount, duration);
    }

    function pay(
        uint256 amount,
        address currency,
        uint256 index
    ) public payable override {
        require(amount > 0, "Non zero borrows");
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        identity.sendTokens(
            address(_cdoc),
            abi.encodeWithSignature("repayBorrow(uint256)", type(uint256).max), // max uint to repay whole debt
            currency,
            amount,
            _cdoc
        );

        emit Pay(index, msg.sender, currency, amount);
    }

    function debtBalance() public view returns (uint256) {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);
        bytes memory data = identity.read(
            address(_cdoc),
            abi.encodeWithSignature(
                "borrowBalanceStored(address)",
                address(identity)
            )
        );

        uint256 borrowBalance = abi.decode(data, (uint256));

        return borrowBalance;
    }

    function getLendBalance() public view returns (uint256) {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        bytes memory data = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(data, (uint256));

        bytes memory balanceData = identity.read(
            address(_crbtc),
            abi.encodeWithSignature("balanceOf(address)", address(identity))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));
        return (exchangeRate * tokens) / 1e18;
    }

    // Only using RBTC as collateral after will be defining by the listing loanToValueTokenAddr
    function calculateAmountToLend(uint256 amount)
        public
        view
        returns (uint256)
    {
        UserIdentity identity = UserIdentityFactory(_userIdentityFactory)
            .getIdentity(msg.sender);

        bytes memory priceCollateralData = identity.read(
            address(_oracle),
            abi.encodeWithSignature("getUnderlyingPrice(address)", _crbtc)
        );

        uint256 rbtcPrice = abi.decode(priceCollateralData, (uint256));

        bytes memory priceCurrencyData = identity.read(
            address(_oracle),
            abi.encodeWithSignature("getUnderlyingPrice(address)", _cdoc)
        );

        uint256 docPrice = abi.decode(priceCurrencyData, (uint256));

        bytes memory collateralMarketData = identity.read(
            address(_comptroller),
            abi.encodeWithSignature("markets(address)", address(_crbtc))
        );

        (, uint256 collateralFactor, ) = abi.decode(
            collateralMarketData,
            (bool, uint256, bool)
        );

        return ((amount * docPrice) * 1e18) / (collateralFactor * rbtcPrice);
    }

    function createIdentity() public {
        UserIdentityFactory(_userIdentityFactory).createIdentity(msg.sender);
    }
}
