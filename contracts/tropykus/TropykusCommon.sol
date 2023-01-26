// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import {ServiceListing} from "../services/ServiceData.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/IForwarder.sol";

abstract contract TropykusCommon {
    uint256 internal constant _UNIT_DECIMAL_PRECISION = 1e18;

    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    /**
     * @notice Emitted when funds get withdrawn from the service
     * @param listingId The id of the listing
     * @param withdrawer The address of the withdrawer
     * @param currency The currency of the listing
     * @param amount The amount of funds withdrawn
     */
    event Withdraw(
        uint256 indexed listingId,
        address indexed withdrawer,
        address indexed currency,
        uint256 amount
    );

    error ERC20TransferFromFailed(
        address currency,
        address from,
        address to,
        uint256 amount
    );
    error ERC20ApproveFailed(address currency, address spender, uint256 amount);
    error InsufficientLendingAmount(address currency);
    error InvalidLendingCurrency(address expectedCurrency);
    error UnexpectedRBTC();
    error MintTokensInMarketError(address market, address currency);
    error ReedemOperationFailed(bytes response);

    SmartWalletFactory internal immutable _smartWalletFactory;

    constructor(SmartWalletFactory smartWalletFactory) {
        _smartWalletFactory = smartWalletFactory;
    }

    /**
     * @notice Validates that the amount is available and greater than zero
     * @param currency The address of the currency of the lending
     * @return amountToLend The amount to lend
     */
    function _validateAndGetAmountToLend(address currency)
        internal
        returns (uint256 amountToLend)
    {
        IForwarder smartWallet = IForwarder(
            _smartWalletFactory.getSmartWallet(msg.sender)
        );

        if (currency != address(0) && msg.value > 0) {
            revert UnexpectedRBTC();
        }

        amountToLend = msg.value > 0
            ? msg.value
            : IERC20(currency).allowance(msg.sender, address(smartWallet));

        if (amountToLend == 0) {
            revert InsufficientLendingAmount(currency);
        }
    }

    /**
     * @notice Call tropykus mint function to get the kTokens
     * and start accruing interest over the lending
     * @param mtx The meta transaction
     * @param currency The currency of the lending
     * @param amount The amount to lend into tropykus protocol
     * @param market The address of the tropykus market that uses the currency
     */
    function _mintTokensInMarket(
        IForwarder.MetaTransaction calldata mtx,
        address currency,
        uint256 amount,
        address market
    ) internal {
        IForwarder smartWallet = IForwarder(
            _smartWalletFactory.getSmartWalletAddress(msg.sender)
        );

        // mint tokens to market depending on the token RBTC/ERC20
        bool transferHasRBTC = msg.value > 0;
        bytes memory mintSignature = transferHasRBTC
            ? abi.encodeWithSignature("mint()")
            : abi.encodeWithSignature("mint(uint256)", amount);

        //slither-disable-next-line arbitrary-send-eth
        (bool success, ) = smartWallet.execute{
            value: transferHasRBTC ? msg.value : 0
        }(mtx, mintSignature, market);

        if (!success) {
            revert MintTokensInMarketError(market, currency);
        }
    }

    /*
     * @notice for ERC20 token transfer funds from the msg.sender
     * to the smart wallet and approve the smart wallet to spend
     * the funds
     * @param mtx The meta transaction
     * @param market The address of the tropykus market that uses
     * the currency of the listing
     * @param erc20Token The address of the ERC20 token
     * @param amount The amount of funds to transfer
     */
    function _transferAndApproveERC20ToMarket(
        IForwarder.MetaTransaction calldata mtx,
        address market,
        address erc20Token,
        uint256 amount
    ) internal {
        IForwarder smartWallet = IForwarder(
            _smartWalletFactory.getSmartWalletAddress(msg.sender)
        );

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
            erc20Token
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
            abi.encodeWithSignature("approve(address,uint256)", market, amount),
            erc20Token
        );

        if (!approveTxSuccess) {
            revert ERC20ApproveFailed({
                currency: erc20Token,
                spender: market,
                amount: amount
            });
        }
    }

    /**
     * @notice Redeem the kTokens and get the underlying currency
     * @param mtx The meta transaction
     * @param listingId The id of the listing
     * @param currencyLent The currency of the listing
     * @param market The address of the tropykus market that uses
     * the currency of the listing
     */
    // slither-disable-next-line reentrancy-events
    function _withdraw(
        IForwarder.MetaTransaction calldata mtx,
        uint256 listingId,
        address currencyLent,
        address market
    ) internal {
        SmartWallet smartWallet = SmartWallet(
            payable(_smartWalletFactory.getSmartWalletAddress(msg.sender))
        );
        // slither-disable-next-line low-level-calls
        (, bytes memory balanceData) = market.call(
            abi.encodeWithSignature("balanceOf(address)", address(smartWallet))
        );
        uint256 tokens = abi.decode(balanceData, (uint256));
        if (tokens == 0) {
            revert("no tokens to withdraw");
        }
        // slither-disable-next-line low-level-calls
        (bool success, bytes memory res) = smartWallet.executeAndForwardTokens(
            mtx,
            abi.encodeWithSignature("redeem(uint256)", tokens),
            market,
            currencyLent
        );

        if (!success) {
            revert ReedemOperationFailed(res);
        }
        // slither-disable-next-line low-level-calls
        (, bytes memory data) = market.call(
            abi.encodeWithSignature("exchangeRateStored()")
        );

        uint256 exchangeRate = abi.decode(data, (uint256));
        emit Withdraw({
            listingId: listingId,
            withdrawer: msg.sender,
            currency: currencyLent,
            amount: (tokens * exchangeRate) / _UNIT_DECIMAL_PRECISION
        });
    }

    /**
     * @notice Get the address of the market that uses the currency
     * @param currency The currency of the listing
     * @param comptroller The address of the tropykus comptroller
     * @param crbtc The address of the market of tropykus crbtc
     * @return The address of the market
     */
    function _getMarketForCurrency(
        address currency,
        address comptroller,
        address crbtc
    ) internal view returns (address) {
        if (currency == address(0)) {
            return crbtc;
        }
        IcErc20[] memory markets = IComptrollerG6(comptroller).getAllMarkets();
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

    /**
     * @notice Compare two strings
     * @param a The first string
     * @param b The second string
     * @return true if the strings are equal
     */
    function _compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
