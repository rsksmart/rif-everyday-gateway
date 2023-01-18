// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import "../services/BorrowService.sol";
import "contracts/services/BorrowService.sol";
import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/SmartWallet.sol";
import "../smartwallet/IForwarder.sol";
import "./ITropykus.sol";

/* solhint-disable avoid-low-level-calls */

contract TropykusBorrowingService is BorrowService {
    error InvalidCollateralAmount(uint256 amount, uint256 expectedAmount);
    error MissingIdentity(address user);
    error CollateralTransferFailed(
        address smartWallet,
        address collateralMarket,
        address collateralCurrency,
        uint256 amount
    );
    error ERC20TransferFromFailed(
        address currency,
        address from,
        address to,
        uint256 amount
    );
    error ERC20ApproveFailed(address currency, address spender, uint256 amount);

    uint256 private constant _UNIT_DECIMAL_PRECISION = 1e18;
    // Amount that will prevent the user to get liquidated at a first instance for a price fluctuation on the collateral.
    uint256 private constant _DELTA_COLLATERAL_WITH_PRECISION = 5e18;

    address private _comptroller;
    address private _oracle;
    address private _crbtc;
    address private _cdoc;
    SmartWalletFactory private _smartWalletFactory;
    uint256 private constant _BLOCKS_PER_YEAR = 2 * 60 * 24 * 365; // blocks created every 30 seconds aprox

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    constructor(
        address gateway,
        SmartWalletFactory smartWalletFactory,
        TropykusContracts memory contracts
    ) BorrowService(gateway, "Tropykus") {
        _comptroller = contracts.comptroller;
        _oracle = contracts.oracle;
        _crbtc = contracts.crbtc;
        _cdoc = contracts.cdoc;
        _smartWalletFactory = smartWalletFactory;
    }

    function borrow(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId,
        uint256 duration,
        address wallet
    )
        public
        payable
        override
        onlyValidAmount(listingId, amount)
        withSubscription(mtx.req.from, listingId, wallet)
    {
        ServiceListing memory listing = listings[listingId];
        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );

        uint256 collateralPayment = _validateAndCalculateRequiredCollateral(
            smartWallet,
            listing,
            amount
        );

        _removeLiquidityInternal(amount, listingId);
        _sendCollateralToProtocol(smartWallet, mtx, listing, collateralPayment);
        _enterMarkets(smartWallet, mtx, listing);
        _borrow(mtx, listing, amount, duration);
    }

    function _validateAndCalculateRequiredCollateral(
        IForwarder smartWallet,
        ServiceListing memory listing,
        uint256 amountToBorrow
    ) internal returns (uint256 collateralPayment) {
        if (listing.collateralCurrency != address(0) && msg.value > 0) {
            revert InvalidCollateralCurrency({
                expectedCurrency: listing.collateralCurrency
            });
        }

        collateralPayment = _transferHasRBTC()
            ? msg.value
            : IERC20(listing.collateralCurrency).allowance(
                msg.sender,
                address(smartWallet)
            );

        if (collateralPayment == 0) {
            revert InsufficientCollateral(listing.collateralCurrency);
        }

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
        uint256 collateralMarketPrice = IPriceOracleProxy(_oracle)
            .getUnderlyingPrice(
                getMarketForCurrency(listing.collateralCurrency)
            );
        (, uint256 collateralFactor) = IComptrollerG6(_comptroller).markets(
            getMarketForCurrency(listing.collateralCurrency)
        );
        uint256 borrowCurrencyMarketPrice = IPriceOracleProxy(_oracle)
            .getUnderlyingPrice(getMarketForCurrency(listing.currency));

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
        address collateralCurrencyMarket = getMarketForCurrency(
            listing.collateralCurrency
        );
        bool success;
        bool isCollateralInRBTC = _transferHasRBTC();

        if (isCollateralInRBTC) {
            assert(msg.value == collateral);
        } else {
            _transferAndApproveERC20ToMarket(
                smartWallet,
                mtx,
                listing.collateralCurrency,
                collateral
            );
        }

        bytes memory mintSignature = isCollateralInRBTC
            ? abi.encodeWithSignature("mint()")
            : abi.encodeWithSignature("mint(uint256)", collateral);

        (success, ) = smartWallet.execute{
            value: isCollateralInRBTC ? msg.value : 0
        }(
            mtx,
            mintSignature,
            collateralCurrencyMarket,
            isCollateralInRBTC ? listing.collateralCurrency : address(0)
        );

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
        markets[0] = getMarketForCurrency(listing.collateralCurrency);
        markets[1] = getMarketForCurrency(listing.currency);

        smartWallet.execute(
            mtx,
            abi.encodeWithSignature("enterMarkets(address[])", markets),
            address(_comptroller),
            address(0)
        );
    }

    function _borrow(
        IForwarder.MetaTransaction calldata mtx,
        ServiceListing memory listing,
        uint256 amount,
        uint256 duration
    ) internal {
        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );
        smartWallet.execute(
            mtx,
            abi.encodeWithSignature("borrow(uint256)", amount),
            getMarketForCurrency(listing.currency),
            listing.currency
        );

        emit Borrow({
            listingId: listing.id,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount,
            duration: duration
        });
    }

    function pay(
        IForwarder.MetaTransaction calldata mtx,
        uint256 amount,
        uint256 listingId
    ) public payable override {
        ServiceListing memory listing = listings[listingId];

        if (amount <= 0)
            revert InsufficientCollateral(listing.collateralCurrency);
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        _transferAndApproveERC20ToMarket(
            smartWallet,
            mtx,
            listing.currency,
            amount
        );

        bytes memory repayBorrowSignature = _transferHasRBTC()
            ? abi.encodeWithSignature("repayBorrowAll()")
            : abi.encodeWithSignature(
                "repayBorrow(uint256)",
                type(uint256).max
            );

        smartWallet.execute{value: msg.value}(
            mtx,
            repayBorrowSignature,
            getMarketForCurrency(listing.currency),
            listing.currency
        );

        emit Pay({
            listingId: listingId,
            borrower: msg.sender,
            currency: listing.currency,
            amount: amount
        });
    }

    function _transferAndApproveERC20ToMarket(
        IForwarder smartWallet,
        IForwarder.MetaTransaction calldata mtx,
        address erc20Token,
        uint256 amount
    ) internal {
        bool transferFromTxSuccess;
        bool approveTxSuccess;
        (transferFromTxSuccess, ) = smartWallet.execute(
            mtx,
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                mtx.req.from,
                address(smartWallet),
                amount
            ),
            erc20Token,
            address(0)
        );

        if (!transferFromTxSuccess) {
            revert ERC20TransferFromFailed({
                currency: erc20Token,
                from: mtx.req.from,
                to: address(smartWallet),
                amount: amount
            });
        }

        (approveTxSuccess, ) = smartWallet.execute(
            mtx,
            abi.encodeWithSignature(
                "approve(address,uint256)",
                getMarketForCurrency(erc20Token),
                amount
            ),
            erc20Token,
            address(0)
        );

        if (!approveTxSuccess) {
            revert ERC20ApproveFailed({
                currency: erc20Token,
                spender: getMarketForCurrency(erc20Token),
                amount: amount
            });
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

        address collateralCurrencyMarket = getMarketForCurrency(
            listings[listingId].collateralCurrency
        );

        (, bytes memory exchangeRatedata) = collateralCurrencyMarket.staticcall(
            abi.encodeWithSignature("exchangeRateStored()")
        );
        uint256 exchangeRate = abi.decode(exchangeRatedata, (uint256));

        (, bytes memory balanceData) = collateralCurrencyMarket.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));

        return (exchangeRate * tokens) / _UNIT_DECIMAL_PRECISION;
    }

    function withdraw(IForwarder.MetaTransaction calldata mtx, address currency)
        public
        override
    {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );

        address market = getMarketForCurrency(currency);
        (, bytes memory balanceData) = market.call(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );

        uint256 tokens = abi.decode(balanceData, (uint256));
        if (tokens == 0) {
            revert("no tokens to withdraw");
        }

        (bool success, bytes memory res) = smartWallet.execute(
            mtx,
            abi.encodeWithSignature("redeem(uint256)", tokens),
            market,
            currency
        );

        if (success) {
            (, bytes memory data) = market.call(
                abi.encodeWithSignature("exchangeRateStored()")
            );

            uint256 exchangeRate = abi.decode(data, (uint256));
            emit Withdraw({
                listingId: 0,
                withdrawer: msg.sender,
                currency: address(0),
                amount: (tokens * exchangeRate) / _UNIT_DECIMAL_PRECISION
            });
        } else {
            revert FailedOperation(res);
        }
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

        (, bytes memory data) = getMarketForCurrency(currency).staticcall(
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
            IcErc20(getMarketForCurrency(listing.currency))
                .borrowRatePerBlock() *
            _BLOCKS_PER_YEAR;
        return listing;
    }

    function getMarketForCurrency(address currency)
        public
        view
        returns (address)
    {
        if (currency == address(0)) {
            return _crbtc;
        }
        IcErc20[] memory markets = IComptrollerG6(_comptroller).getAllMarkets();

        for (uint256 i = 0; i < markets.length; i++) {
            if (
                !_compareStrings(markets[i].symbol(), "kSAT") &&
                !_compareStrings(markets[i].symbol(), "kRBTC") &&
                markets[i].underlying() == currency
            ) {
                return address(markets[i]);
            }
        }
        return address(0);
    }

    function _compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
