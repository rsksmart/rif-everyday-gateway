// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.16;

import {IPriceOracleProxy, IComptrollerG6, IcErc20} from "contracts/tropykus/ITropykus.sol";
import "../smartwallet/SmartWalletFactory.sol";
import "../smartwallet/IForwarder.sol";

abstract contract TropykusCommon {
    struct TropykusContracts {
        address comptroller;
        address oracle;
        address crbtc;
        address cdoc;
    }

    function _mintMarketTokens(
        IForwarder.MetaTransaction calldata mtx,
        SmartWalletFactory _smartWalletFactory,
        address currency,
        uint256 amount,
        address market
    ) internal returns (bool success, bytes memory ret) {
        SmartWallet smartWallet = _smartWalletFactory.getSmartWallet(
            msg.sender
        );

        if (currency != address(0)) {
            smartWallet.execute(
                mtx,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    mtx.req.from,
                    address(smartWallet),
                    amount
                ),
                currency,
                address(0)
            );

            smartWallet.execute(
                mtx,
                abi.encodeWithSignature(
                    "approve(address,uint256)",
                    market,
                    amount
                ), // max uint to repay whole debt
                currency,
                address(0)
            );


            (success, ret) = smartWallet.execute(
                mtx,
                abi.encodeWithSignature("mint(uint256)", amount),
                address(market),
                address(0)
            );
        } else {
            // Suppressed: The success bool is validated outside of this function
            // and the market will always be a CToken
            //slither-disable-next-line arbitrary-send-eth
            (success, ret) = smartWallet.execute{value: amount}(
                mtx,
                abi.encodeWithSignature("mint()"),
                address(market),
                address(0)
            );
        }
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

    function _compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
