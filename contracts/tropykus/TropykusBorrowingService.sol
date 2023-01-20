// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "contracts/services/BorrowService.sol";
import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";
import "./ITropykus.sol";
import {TropykusCommon} from "./TropykusCommon.sol";

/* solhint-disable avoid-low-level-calls */

contract TropykusBorrowingService is BorrowService, TropykusCommon {
    error InvalidCollateralAmount(uint256 amount, uint256 expectedAmount);
    error MissingIdentity(address user);
    error CollateralTransferFailed(
        address smartWallet,
        address collateralMarket,
        address collateralCurrency,
        uint256 amount
    );

    // Amount that will prevent the user to get liquidated at a first instance for a price fluctuation on the collateral.
    uint256 private constant _DELTA_COLLATERAL_WITH_PRECISION = 5e18;

    address private _comptroller;
    address private _oracle;
    address private _crbtc;
    address private _cdoc;
    uint256 private constant _BLOCKS_PER_YEAR = 2 * 60 * 24 * 365; // blocks created every 30 seconds aprox

    constructor(
        address gateway,
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) BorrowService(gateway, "Tropykus") TropykusCommon(smartWalletFactory) {
        _comptroller = contracts.comptroller;
        _oracle = contracts.oracle;
        _crbtc = contracts.crbtc;
        _cdoc = contracts.cdoc;
    }

    function borrow(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        uint256 duration,
        address wallet
    ) public payable override {
        ServiceListing memory listing = listings[listingId];
        uint256 _amountToLend = listing.collateralCurrency == address(0)
            ? msg.value
            : amount;

        if (amount == 0) {
            revert ZeroAmountNotAllowed({currency: listing.currency});
        }
        if (_amountToLend == 0) {
            revert ZeroAmountNotAllowed({currency: listing.collateralCurrency});
        }

        _onlyValidListingArgs(listingId, amount);
        _removeLiquidityInternal(amount, listingId);

        emit Borrow({
            listingId: listing.id,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount,
            duration: duration
        });

        _withSubscription(mtx.req.from, listingId, wallet);
        uint256 collateralPayment = _validateAndCalculateRequiredCollateral(
            listing,
            amount
        );

        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );

        _sendCollateralToProtocol(smartWallet, mtx, listing, collateralPayment);
        _enterMarkets(smartWallet, mtx, listing);
        _borrow(mtx, listing, amount);
    }

    function _validateAndCalculateRequiredCollateral(
        ServiceListing memory listing,
        uint256 amountToBorrow
    ) internal returns (uint256 collateralPayment) {
        collateralPayment = _validateAndGetAmountToLend(
            listing.collateralCurrency
        );

        uint256 requiredCollateral = calculateRequiredCollateral(
            listing.id,
            amountToBorrow
        );

        if (collateralPayment != requiredCollateral) {
            revert InvalidCollateralAmount(
                collateralPayment,
                requiredCollateral
            );
        }
    }

    // Only using RBTC as collateral after will be defining by the listing collateralCurrency
    function calculateRequiredCollateral(
        uint256 listingId,
        uint256 amountToBorrow
    ) public view override returns (uint256) {
        ServiceListing memory listing = listings[listingId];
        address collateralMarket = _getMarketForCurrency(
            listing.collateralCurrency,
            _comptroller,
            _crbtc
        );

        uint256 collateralMarketPrice = IPriceOracleProxy(_oracle)
            .getUnderlyingPrice(collateralMarket);
        (, uint256 collateralFactor) = IComptrollerG6(_comptroller).markets(
            collateralMarket
        );
        uint256 borrowCurrencyMarketPrice = IPriceOracleProxy(_oracle)
            .getUnderlyingPrice(
                _getMarketForCurrency(listing.currency, _comptroller, _crbtc)
            );

        return
            (((amountToBorrow + _DELTA_COLLATERAL_WITH_PRECISION) *
                borrowCurrencyMarketPrice) * _UNIT_DECIMAL_PRECISION) /
            (collateralFactor * collateralMarketPrice);
    }

    function _sendCollateralToProtocol(
        IForwarder smartWallet,
        IForwarder.MetaTransaction calldata mtx,
        ServiceListing memory listing,
        uint256 collateral
    ) internal {
        address collateralCurrencyMarket = _getMarketForCurrency(
            listing.collateralCurrency,
            _comptroller,
            _crbtc
        );
        bool success;
        bool isCollateralInRBTC = msg.value > 0;

        if (isCollateralInRBTC) {
            assert(msg.value == collateral);
        } else {
            _transferAndApproveERC20ToMarket(
                mtx,
                collateralCurrencyMarket,
                listing.collateralCurrency,
                collateral
            );
        }

        bytes memory mintSignature = isCollateralInRBTC
            ? abi.encodeWithSignature("mint()")
            : abi.encodeWithSignature("mint(uint256)", collateral);

        // slither-disable-next-line arbitrary-send-eth
        (success, ) = smartWallet.execute{
            value: isCollateralInRBTC ? msg.value : 0
        }(mtx, mintSignature, collateralCurrencyMarket, address(0));

        if (!success) {
            revert CollateralTransferFailed(
                address(smartWallet),
                collateralCurrencyMarket,
                listing.collateralCurrency,
                isCollateralInRBTC ? msg.value : collateral
            );
        }
    }

    function _enterMarkets(
        IForwarder smartWallet,
        IForwarder.MetaTransaction calldata mtx,
        ServiceListing memory listing
    ) internal {
        address[] memory markets = new address[](2);

        // TODO: are these the only markets to be used?
        markets[0] = _getMarketForCurrency(
            listing.collateralCurrency,
            _comptroller,
            _crbtc
        );
        markets[1] = _getMarketForCurrency(
            listing.currency,
            _comptroller,
            _crbtc
        );

        (bool success, bytes memory resp) = smartWallet.execute(
            mtx,
            abi.encodeWithSignature("enterMarkets(address[])", markets),
            address(_comptroller),
            address(0)
        );

        if (!success) {
            revert FailedOperation(resp);
        }
    }

    function _borrow(
        IForwarder.MetaTransaction calldata mtx,
        ServiceListing memory listing,
        uint256 amount
    ) internal {
        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );
        (bool success, bytes memory resp) = smartWallet.execute(
            mtx,
            abi.encodeWithSignature("borrow(uint256)", amount),
            _getMarketForCurrency(listing.currency, _comptroller, _crbtc),
            listing.currency
        );

        if (!success) {
            revert FailedOperation(resp);
        }
    }

    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) public payable override {
        ServiceListing memory listing = listings[listingId];
        address market = _getMarketForCurrency(
            listing.currency,
            _comptroller,
            _crbtc
        );

        if (amount <= 0) {
            revert InsufficientCollateral(listing.collateralCurrency);
        }

        emit Pay({
            listingId: listingId,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount
        });

        _transferAndApproveERC20ToMarket(mtx, market, listing.currency, amount);

        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        bytes memory repayBorrowSignature = msg.value > 0
            ? abi.encodeWithSignature("repayBorrowAll()")
            : abi.encodeWithSignature(
                "repayBorrow(uint256)",
                type(uint256).max
            );

        // slither-disable-next-line arbitrary-send-eth
        (bool success, bytes memory resp) = smartWallet.execute{
            value: msg.value
        }(mtx, repayBorrowSignature, market, listing.currency);

        if (!success) {
            revert FailedOperation(resp);
        }
    }

    function getCollateralBalance(uint256 listingId)
        public
        view
        returns (uint256)
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        address collateralCurrencyMarket = _getMarketForCurrency(
            listings[listingId].collateralCurrency,
            _comptroller,
            _crbtc
        );

        // slither-disable-next-line low-level-calls
        (, bytes memory exchangeRatedata) = collateralCurrencyMarket.staticcall(
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(exchangeRatedata, (uint256));
        // slither-disable-next-line low-level-calls
        (, bytes memory balanceData) = collateralCurrencyMarket.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }

    function withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId
    ) public override {
        ServiceListing memory listing = listings[listingId];

        address market = _getMarketForCurrency(
            listing.collateralCurrency,
            _comptroller,
            _crbtc
        );

        _withdraw(mtx, listingId, listing.collateralCurrency, market);
    }

    function getBalance(address currency)
        public
        view
        override(IService)
        returns (uint256 balanceBorrowed)
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        // slither-disable low-level-calls missing-zero-check
        (, bytes memory data) = _getMarketForCurrency(
            currency,
            _comptroller,
            _crbtc
        ).staticcall(
                abi.encodeWithSignature(
                    "borrowBalanceStored(address)",
                    address(smartWallet)
                )
            );

        balanceBorrowed = abi.decode(data, (uint256));
    }

    function getListing(uint256 listingId)
        public
        view
        override
        returns (ServiceListing memory)
    {
        ServiceListing memory listing = listings[listingId];
        listing.interestRate =
            IcErc20(
                _getMarketForCurrency(listing.currency, _comptroller, _crbtc)
            ).borrowRatePerBlock() *
            _BLOCKS_PER_YEAR;
        return listing;
    }
}
