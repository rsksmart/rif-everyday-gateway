import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  TropykusBorrowingService,
  IERC20,
  IFeeManager,
  IRIFGateway,
  SmartWalletFactory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { signTransactionForExecutor } from '../smartwallet/utils';
import { tropykusFixture } from 'test/utils/tropykusFixture';
import { PaybackOption } from '../constants/service';
import { deployRIFGateway, toSmallNumber } from './utils';
import { ContractReceipt, Wallet } from 'ethers';
import { deployContract } from 'utils/deployment.utils';
import { $TropykusBorrowingService } from '../../typechain-types/contracts-exposed/tropykus/TropykusBorrowingService.sol/$TropykusBorrowingService';

describe('Tropykus Borrowing Service', () => {
  let owner: SignerWithAddress;
  let tropykusBorrowingService: $TropykusBorrowingService;
  let smartWalletFactory: SmartWalletFactory;
  let smartWalletAddress: string;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let doc: IERC20;
  let rif: IERC20;
  let cRBTC: IERC20;
  let tropykusContractsDeployed: any;
  let feeManager: IFeeManager;
  let RIFGateway: IRIFGateway;

  before(async () => {
    [owner] = await ethers.getSigners();
    ({ smartWalletFactory } = await smartwalletFactoryFixture());
    ({ privateKey, externalWallet } = await externalSmartwalletFixture(
      smartWalletFactory,
      owner
    ));
    smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
      externalWallet.address
    );
  });

  beforeEach(async () => {
    tropykusContractsDeployed = await tropykusFixture();

    doc = (await ethers.getContractAt(
      'IERC20',
      tropykusContractsDeployed.doc,
      owner
    )) as IERC20;

    rif = (await ethers.getContractAt(
      'IERC20',
      tropykusContractsDeployed.doc,
      owner
    )) as IERC20;

    cRBTC = (await ethers.getContractAt(
      'IERC20',
      tropykusContractsDeployed.crbtc,
      owner
    )) as IERC20;

    ({ RIFGateway: RIFGateway, feeManager: feeManager } =
      await deployRIFGateway());

    ({ contract: tropykusBorrowingService } =
      await deployContract<$TropykusBorrowingService>(
        '$TropykusBorrowingService',
        {
          gateway: RIFGateway.address,
          smartWalletFactory: smartWalletFactory.address,
          contracts: tropykusContractsDeployed,
        }
      ));

    await (
      await RIFGateway.addService(tropykusBorrowingService.address)
    ).wait();
  });

  it('should retrieve service name', async () => {
    const name = await tropykusBorrowingService.serviceProviderName();
    expect(name).equals('Tropykus');
  });

  it('should revert while trying to consume a service that is not added in the gateway', async () => {
    const amountToBorrow = 2;

    const calculateAmountToLend = await tropykusBorrowingService
      .connect(externalWallet)
      .calculateRequiredCollateral(
        0,
        ethers.utils.parseEther(amountToBorrow.toString())
      );

    const amountToLend = +calculateAmountToLend / 1e18;

    const mtx = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusBorrowingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    await expect(
      tropykusBorrowingService.connect(externalWallet).borrow(
        mtx,
        ethers.utils.parseEther(amountToBorrow.toString()),
        0, // Not in use for now
        0, // Not in use for now
        ethers.constants.AddressZero,
        {
          value: ethers.utils.parseEther(amountToLend.toString()),
        }
      )
    ).to.be.rejected;
  });

  const createListing = async (
    collateralCurrency: string,
    borrowCurrency: string
  ) => {
    await (
      await tropykusBorrowingService.connect(owner).addListing({
        id: 0,
        minAmount: ethers.utils.parseEther('1'),
        maxAmount: ethers.utils.parseEther('100'),
        minDuration: 0,
        maxDuration: 1000,
        interestRate: ethers.utils.parseEther('0.01'), // 1%
        collateralCurrency,
        currency: borrowCurrency,
        payBackOption: PaybackOption.Day,
        enabled: true,
        name: 'Tropykus Borrow Service',
        owner: owner.address,
      })
    ).wait();
  };

  describe('Borrow/Repay ', () => {
    it('should retrieve listing', async () => {
      await createListing(ethers.constants.AddressZero, doc.address);
      const listing = await tropykusBorrowingService.getListing(0);
      expect(listing.name).equals('Tropykus Borrow Service');
    });

    it('should retrieve market for currency', async () => {
      await createListing(ethers.constants.AddressZero, doc.address);
      const tropykusBorrow = (await ethers.getContractAt(
        '$TropykusBorrowingService',
        tropykusBorrowingService.address,
        owner
      )) as $TropykusBorrowingService;

      const cdoc = await tropykusBorrow.$_getMarketForCurrency(
        tropykusContractsDeployed.doc,
        tropykusContractsDeployed.comptroller,
        tropykusContractsDeployed.crbtc
      );
      expect(cdoc.toLowerCase()).equals(
        tropykusContractsDeployed.cdoc.toLowerCase()
      );

      const crbtc = await tropykusBorrow.$_getMarketForCurrency(
        ethers.constants.AddressZero,
        tropykusContractsDeployed.comptroller,
        tropykusContractsDeployed.crbtc
      );
      expect(crbtc.toLowerCase()).equals(
        tropykusContractsDeployed.crbtc.toLowerCase()
      );
    });

    describe('With RBTC as collateral', () => {
      beforeEach(async () => {
        await createListing(ethers.constants.AddressZero, doc.address);
      });

      it('should borrow ERC20 after lending RBTC on tropykus', async () => {
        const amountToBorrow = 2;

        const beforeLiquidity = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = toSmallNumber(calculateAmountToLend);
        expect(amountToLend).to.be.closeTo(0.0007, 0.0001);

        const balanceUserBefore = await doc.balanceOf(externalWallet.address);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero,
            {
              value: ethers.utils.parseEther(amountToLend.toString()),
            }
          );
        await tx.wait();

        const afterLiquidity = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const expectedAmountToBorrow =
          toSmallNumber(beforeLiquidity) - toSmallNumber(afterLiquidity);
        expect(amountToBorrow).equals(expectedAmountToBorrow);

        const balanceTropAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getCollateralBalance(0);

        expect(toSmallNumber(balanceTropAfter)).to.equal(amountToLend);

        // TODO: is cRBTC the right contract to look for btc ?
        const smartWalletBalance = toSmallNumber(
          await doc.balanceOf(smartWalletAddress)
        );
        expect(smartWalletBalance).to.equal(0);

        const actualBalanceUserAfter = toSmallNumber(
          await doc.balanceOf(externalWallet.address)
        );
        const expectedUserBalanceAfterBorrow =
          toSmallNumber(balanceUserBefore) + amountToBorrow;

        expect(actualBalanceUserAfter).to.equal(expectedUserBalanceAfterBorrow);
      });

      it('should repay ERC20 borrow debt', async () => {
        const amountToBorrow = 5;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const docBalanceBefore = await doc.balanceOf(externalWallet.address);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const amountToLend = +calculateAmountToLend / 1e18;

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // Not in use for now
            0, // Not in use for now
            ethers.constants.AddressZero,
            {
              value: ethers.utils.parseEther(amountToLend.toFixed(18)),
            }
          );
        await tx.wait();

        const docBalanceAfterBorrow = await doc.balanceOf(
          externalWallet.address
        );
        const expectedBalance = docBalanceBefore.add(amountToBorrow);

        expect(toSmallNumber(docBalanceAfterBorrow)).to.be.equal(
          expectedBalance.toNumber()
        );

        const forInterest = ethers.utils.parseEther('0.2');
        // Extra balance to pay interest $0.2
        await doc.transfer(externalWallet.address, forInterest);
        const docBalanceAfterWithInterest = await doc.balanceOf(
          externalWallet.address
        );

        expect(docBalanceAfterWithInterest).to.be.equals(
          forInterest.add(docBalanceAfterBorrow)
        );

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);

        const borrowBalancePlusCent = borrowBalance.add(forInterest);

        const approvedValue = borrowBalancePlusCent.lt(
          docBalanceAfterWithInterest
        )
          ? borrowBalancePlusCent
          : docBalanceAfterWithInterest;

        const approveTx = await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, approvedValue);
        await approveTx.wait();

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0, {});
        await payTx.wait();

        const borrowBalanceAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);
        expect(toSmallNumber(borrowBalanceAfter)).to.eq(0);

        const actualDocBalanceAfterPayDebt = toSmallNumber(
          await doc.balanceOf(externalWallet.address)
        );

        const expectedDocBalanceAfterPayDebt =
          toSmallNumber(docBalanceAfterWithInterest) -
          toSmallNumber(borrowBalancePlusCent);
        expect(actualDocBalanceAfterPayDebt).to.be.closeTo(
          expectedDocBalanceAfterPayDebt,
          toSmallNumber(forInterest)
        );
      });

      it('should withdraw RBTC collateral after paying ERC20 debt', async () => {
        const amountToBorrow = 5;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = toSmallNumber(calculateAmountToLend);
        const docBalanceBefore = await doc.balanceOf(externalWallet.address);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // Not in use for now
            0, // Not in use for now
            ethers.constants.AddressZero,
            {
              value: ethers.utils.parseEther(amountToLend.toFixed(18)),
            }
          );
        await tx.wait();

        const docBalanceAfterBorrow = await doc.balanceOf(
          externalWallet.address
        );
        const expectedBalance = docBalanceBefore.add(amountToBorrow);

        expect(toSmallNumber(docBalanceAfterBorrow)).to.be.equal(
          expectedBalance.toNumber()
        );

        const forInterest = ethers.utils.parseEther('0.2');
        // Extra balance to pay interest $0.2
        await doc.transfer(externalWallet.address, forInterest);
        const docBalanceAfterWithInterest = await doc.balanceOf(
          externalWallet.address
        );

        const expectedDocBalanceAfterWithInterest =
          docBalanceAfterBorrow.add(forInterest);
        expect(
          docBalanceAfterWithInterest,
          'DOC balance with interest equals 5.2 DOC'
        ).to.be.equals(expectedDocBalanceAfterWithInterest);

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);

        const borrowBalancePlusCent = borrowBalance.add(forInterest);

        const approvedValue = borrowBalancePlusCent.lt(
          docBalanceAfterWithInterest
        )
          ? borrowBalancePlusCent
          : docBalanceAfterWithInterest;

        const approveTx = await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, approvedValue);
        await approveTx.wait();

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0);
        await payTx.wait();

        const borrowBalanceAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);

        expect(
          toSmallNumber(borrowBalanceAfter),
          'Borrow balance after pay equals 0'
        ).to.eq(0);

        const actualDocBalanceAfterPayDebt = await doc.balanceOf(
          externalWallet.address
        );
        const expectedDocBalanceAfterPayDebt =
          toSmallNumber(docBalanceAfterWithInterest) -
          toSmallNumber(borrowBalancePlusCent);

        expect(
          toSmallNumber(actualDocBalanceAfterPayDebt),
          'DOC balance after pay must be 0 +- 0.2'
        ).to.be.closeTo(
          expectedDocBalanceAfterPayDebt,
          toSmallNumber(forInterest)
        );

        const balanceTropBefore = await tropykusBorrowingService
          .connect(externalWallet)
          .getCollateralBalance(0);

        expect(
          toSmallNumber(balanceTropBefore),
          'Balance tropykus collateral after payment must be equals amount to lend'
        ).to.be.equals(amountToLend);

        const mtxForWithdrawal = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const withdrawTx = await tropykusBorrowingService
          .connect(externalWallet)
          .withdraw(mtxForWithdrawal, ethers.constants.AddressZero);
        await withdrawTx.wait();

        const balanceTropAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getCollateralBalance(0);

        expect(
          toSmallNumber(balanceTropAfter),
          'Tropykus balance after payment must be 0'
        ).to.equal(0);

        expect(
          await feeManager.getDebtBalance(tropykusBorrowingService.address),
          'Fee balance for service must be great than 0'
        ).to.be.gt(0);
      });
    });

    describe('With ERC20 as collateral', () => {
      function calculateTxGasInRBTC(receipt: ContractReceipt) {
        return receipt.gasUsed.mul(receipt.effectiveGasPrice);
      }

      beforeEach(async () => {
        await createListing(doc.address, ethers.constants.AddressZero);
      });

      it('should borrow RBTC after lending ERC20 on tropykus', async () => {
        const amountToBorrow = 1;

        const userLiquidityBeforeBorrow = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = +calculateAmountToLend / 1e18;
        expect(amountToLend).to.be.closeTo(120000, 1);

        const rbtcBalanceUserBeforeBorrow = await externalWallet.getBalance();

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = toSmallNumber(
          calculateTxGasInRBTC(borrowTxReceipt)
        );

        const userLiquidityAfterBorrow = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const expectedAmountToBorrow =
          toSmallNumber(userLiquidityBeforeBorrow) -
          toSmallNumber(userLiquidityAfterBorrow);
        expect(amountToBorrow).equals(expectedAmountToBorrow);

        const actualUserCollateralBalanceInProtocol =
          await tropykusBorrowingService
            .connect(externalWallet)
            .getCollateralBalance(0);

        expect(
          toSmallNumber(actualUserCollateralBalanceInProtocol)
        ).to.be.closeTo(amountToLend, 1000);

        expect(toSmallNumber(actualUserCollateralBalanceInProtocol)).to.equal(
          amountToLend
        );

        const actualSmartWalletRBTCBalance = await ethers.provider.getBalance(
          smartWalletAddress
        );
        expect(toSmallNumber(actualSmartWalletRBTCBalance)).to.equal(0);

        const balanceUserAfterBorrow = toSmallNumber(
          await externalWallet.getBalance()
        );
        const expectedRBTCBalanceAfterBorrow =
          toSmallNumber(rbtcBalanceUserBeforeBorrow) +
          amountToBorrow -
          borrowTxCost;
        expect(balanceUserAfterBorrow).to.be.closeTo(
          expectedRBTCBalanceAfterBorrow,
          0.001
        );
      });

      it('should repay RBTC borrow debt', async () => {
        const amountToBorrow = 1;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = toSmallNumber(calculateAmountToLend);

        expect(amountToLend).to.be.closeTo(120000, 1);

        const userRBTCBalanceBeforeBorrow = await externalWallet.getBalance();

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = calculateTxGasInRBTC(borrowTxReceipt);

        const actualUserRBTCBalanceAfterBorrow =
          await externalWallet.getBalance();

        const expectedUserRBTCBalanceAfterBorrow = userRBTCBalanceBeforeBorrow
          .add(ethers.utils.parseEther(amountToBorrow.toString()))
          .sub(borrowTxCost);

        expect(toSmallNumber(actualUserRBTCBalanceAfterBorrow)).to.be.closeTo(
          toSmallNumber(expectedUserRBTCBalanceAfterBorrow),
          0.0011
        );

        const forInterest = ethers.utils.parseEther('0.05');
        // Extra balance to pay interest $0.5
        await owner.sendTransaction({
          to: externalWallet.address,
          value: forInterest,
        });

        const actualUserRBTCBalanceWithInterest =
          await externalWallet.getBalance();
        const expectedUserRBTCBalanceWithInterest = toSmallNumber(
          forInterest.add(actualUserRBTCBalanceAfterBorrow).sub(borrowTxCost)
        );
        expect(toSmallNumber(actualUserRBTCBalanceWithInterest)).to.be.closeTo(
          expectedUserRBTCBalanceWithInterest,
          0.003
        );

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(ethers.constants.AddressZero);

        const borrowRBTCBalancePlusCent = borrowBalance
          .add(forInterest)
          .sub(borrowTxCost);

        const approvedValue = borrowRBTCBalancePlusCent.lt(
          actualUserRBTCBalanceWithInterest
        )
          ? borrowRBTCBalancePlusCent
          : actualUserRBTCBalanceWithInterest;

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0, {
            value: approvedValue,
          });

        const payTxReceipt = await payTx.wait();
        const payTxCost = calculateTxGasInRBTC(payTxReceipt);

        const borrowBalanceAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);
        expect(toSmallNumber(borrowBalanceAfter)).to.eq(0);

        const userRBTCBalanceAfterPayingDebt = (
          await externalWallet.getBalance()
        )
          .add(borrowTxCost)
          .add(payTxCost);

        const expectedUserRBTCBalanceAfterPayingDebt =
          toSmallNumber(actualUserRBTCBalanceWithInterest) -
          toSmallNumber(borrowRBTCBalancePlusCent);
        expect(toSmallNumber(userRBTCBalanceAfterPayingDebt)).to.be.closeTo(
          expectedUserRBTCBalanceAfterPayingDebt,
          toSmallNumber(forInterest)
        );
      });

      it('should withdraw ERC20 collateral after paying RBTC debt', async () => {
        const amountToBorrow = 1;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );
        const amountToLend = +calculateAmountToLend / 1e18;

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = calculateTxGasInRBTC(borrowTxReceipt);

        const forInterest = ethers.utils.parseEther('0.05');
        // Extra balance to pay interest $0.5
        await owner.sendTransaction({
          to: externalWallet.address,
          value: forInterest,
        });

        const userRBTCBalanceWithInterest = await externalWallet.getBalance();

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(ethers.constants.AddressZero);

        const borrowRBTCBalancePlusCent = borrowBalance
          .add(forInterest)
          .sub(borrowTxCost);

        const approvedValue = borrowRBTCBalancePlusCent.lt(
          userRBTCBalanceWithInterest
        )
          ? borrowRBTCBalancePlusCent
          : userRBTCBalanceWithInterest;

        const balanceTropBefore = await tropykusBorrowingService
          .connect(externalWallet)
          .getCollateralBalance(0);

        expect(
          toSmallNumber(balanceTropBefore),
          'Balance tropykus collateral after payment must be equals amount to lend'
        ).to.be.equals(amountToLend);

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0, {
            value: approvedValue,
          });

        await payTx.wait();

        const mtxForWithdrawal = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const withdrawTx = await tropykusBorrowingService
          .connect(externalWallet)
          .withdraw(mtxForWithdrawal, 0);
        await withdrawTx.wait();

        const userCollateralBalanceInProtocolAfterWithdraw =
          await tropykusBorrowingService
            .connect(externalWallet)
            .getCollateralBalance(0);

        expect(
          toSmallNumber(userCollateralBalanceInProtocolAfterWithdraw),
          'Tropykus balance after payment must be 0'
        ).to.equal(0);

        expect(
          await feeManager.getDebtBalance(tropykusBorrowingService.address),
          'Fee balance for service must be great than 0'
        ).to.be.gt(0);
      });
    });

    describe('With both ERC20 as collateral and borrow', () => {
      function calculateTxGasInRBTC(receipt: ContractReceipt) {
        return receipt.gasUsed.mul(receipt.effectiveGasPrice);
      }

      beforeEach(async () => {
        await createListing(doc.address, ethers.constants.AddressZero);
      });

      it('should borrow RBTC after lending ERC20 on tropykus', async () => {
        console.log(await externalWallet.getBalance());

        const amountToBorrow = 1;

        const userLiquidityBeforeBorrow = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = +calculateAmountToLend / 1e18;
        expect(amountToLend).to.be.closeTo(120000, 1);

        const rbtcBalanceUserBeforeBorrow = await externalWallet.getBalance();

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = toSmallNumber(
          calculateTxGasInRBTC(borrowTxReceipt)
        );

        const userLiquidityAfterBorrow = await tropykusBorrowingService
          .connect(externalWallet)
          .currentLiquidity(0);

        const expectedAmountToBorrow =
          toSmallNumber(userLiquidityBeforeBorrow) -
          toSmallNumber(userLiquidityAfterBorrow);
        expect(amountToBorrow).equals(expectedAmountToBorrow);

        const actualUserCollateralBalanceInProtocol =
          await tropykusBorrowingService
            .connect(externalWallet)
            .getCollateralBalance(0);

        expect(
          toSmallNumber(actualUserCollateralBalanceInProtocol)
        ).to.be.closeTo(amountToLend, 1000);

        expect(toSmallNumber(actualUserCollateralBalanceInProtocol)).to.equal(
          amountToLend
        );

        const actualSmartWalletRBTCBalance = await ethers.provider.getBalance(
          smartWalletAddress
        );
        expect(toSmallNumber(actualSmartWalletRBTCBalance)).to.equal(0);

        const balanceUserAfterBorrow = toSmallNumber(
          await externalWallet.getBalance()
        );
        const expectedRBTCBalanceAfterBorrow =
          toSmallNumber(rbtcBalanceUserBeforeBorrow) +
          amountToBorrow -
          borrowTxCost;
        expect(balanceUserAfterBorrow).to.be.closeTo(
          expectedRBTCBalanceAfterBorrow,
          0.001
        );
      });

      it('should repay RBTC borrow debt', async () => {
        const amountToBorrow = 1;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );

        const amountToLend = toSmallNumber(calculateAmountToLend);

        expect(amountToLend).to.be.closeTo(120000, 1);

        const userRBTCBalanceBeforeBorrow = await externalWallet.getBalance();

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = calculateTxGasInRBTC(borrowTxReceipt);

        const actualUserRBTCBalanceAfterBorrow =
          await externalWallet.getBalance();

        const expectedUserRBTCBalanceAfterBorrow = userRBTCBalanceBeforeBorrow
          .add(ethers.utils.parseEther(amountToBorrow.toString()))
          .sub(borrowTxCost);

        expect(toSmallNumber(actualUserRBTCBalanceAfterBorrow)).to.be.closeTo(
          toSmallNumber(expectedUserRBTCBalanceAfterBorrow),
          0.0011
        );

        const forInterest = ethers.utils.parseEther('0.05');
        // Extra balance to pay interest $0.5
        await owner.sendTransaction({
          to: externalWallet.address,
          value: forInterest,
        });

        const actualUserRBTCBalanceWithInterest =
          await externalWallet.getBalance();
        const expectedUserRBTCBalanceWithInterest = toSmallNumber(
          forInterest.add(actualUserRBTCBalanceAfterBorrow).sub(borrowTxCost)
        );
        expect(toSmallNumber(actualUserRBTCBalanceWithInterest)).to.be.closeTo(
          expectedUserRBTCBalanceWithInterest,
          0.003
        );

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(ethers.constants.AddressZero);

        const borrowRBTCBalancePlusCent = borrowBalance
          .add(forInterest)
          .sub(borrowTxCost);

        const approvedValue = borrowRBTCBalancePlusCent.lt(
          actualUserRBTCBalanceWithInterest
        )
          ? borrowRBTCBalancePlusCent
          : actualUserRBTCBalanceWithInterest;

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0, {
            value: approvedValue,
          });

        const payTxReceipt = await payTx.wait();
        const payTxCost = calculateTxGasInRBTC(payTxReceipt);

        const borrowBalanceAfter = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(doc.address);
        expect(toSmallNumber(borrowBalanceAfter)).to.eq(0);

        const userRBTCBalanceAfterPayingDebt = (
          await externalWallet.getBalance()
        )
          .add(borrowTxCost)
          .add(payTxCost);

        const expectedUserRBTCBalanceAfterPayingDebt =
          toSmallNumber(actualUserRBTCBalanceWithInterest) -
          toSmallNumber(borrowRBTCBalancePlusCent);
        expect(toSmallNumber(userRBTCBalanceAfterPayingDebt)).to.be.closeTo(
          expectedUserRBTCBalanceAfterPayingDebt,
          toSmallNumber(forInterest)
        );
      });

      it('should withdraw ERC20 collateral after paying RBTC debt', async () => {
        const amountToBorrow = 1;

        const calculateAmountToLend = await tropykusBorrowingService
          .connect(externalWallet)
          .calculateRequiredCollateral(
            0,
            ethers.utils.parseEther(amountToBorrow.toString())
          );
        const amountToLend = +calculateAmountToLend / 1e18;

        await doc.transfer(externalWallet.address, calculateAmountToLend);
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddress, calculateAmountToLend);

        const mtx = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const tx = await tropykusBorrowingService
          .connect(externalWallet)
          .borrow(
            mtx,
            ethers.utils.parseEther(amountToBorrow.toString()),
            0, // listingId
            0, // Not in use for now
            ethers.constants.AddressZero
          );
        const borrowTxReceipt = await tx.wait();
        const borrowTxCost = calculateTxGasInRBTC(borrowTxReceipt);

        const forInterest = ethers.utils.parseEther('0.05');
        // Extra balance to pay interest $0.5
        await owner.sendTransaction({
          to: externalWallet.address,
          value: forInterest,
        });

        const userRBTCBalanceWithInterest = await externalWallet.getBalance();

        const borrowBalance = await tropykusBorrowingService
          .connect(externalWallet)
          .getBalance(ethers.constants.AddressZero);

        const borrowRBTCBalancePlusCent = borrowBalance
          .add(forInterest)
          .sub(borrowTxCost);

        const approvedValue = borrowRBTCBalancePlusCent.lt(
          userRBTCBalanceWithInterest
        )
          ? borrowRBTCBalancePlusCent
          : userRBTCBalanceWithInterest;

        const balanceTropBefore = await tropykusBorrowingService
          .connect(externalWallet)
          .getCollateralBalance(0);

        expect(
          toSmallNumber(balanceTropBefore),
          'Balance tropykus collateral after payment must be equals amount to lend'
        ).to.be.equals(amountToLend);

        const mtxForPayment = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const payTx = await tropykusBorrowingService
          .connect(externalWallet)
          .pay(mtxForPayment, approvedValue, 0, {
            value: approvedValue,
          });

        await payTx.wait();

        const mtxForWithdrawal = await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          tropykusBorrowingService.address,
          smartWalletFactory,
          hre.network.config.chainId
        );

        const withdrawTx = await tropykusBorrowingService
          .connect(externalWallet)
          .withdraw(mtxForWithdrawal, 0);
        await withdrawTx.wait();

        const userCollateralBalanceInProtocolAfterWithdraw =
          await tropykusBorrowingService
            .connect(externalWallet)
            .getCollateralBalance(0);

        expect(
          toSmallNumber(userCollateralBalanceInProtocolAfterWithdraw),
          'Tropykus balance after payment must be 0'
        ).to.equal(0);

        expect(
          await feeManager.getDebtBalance(tropykusBorrowingService.address),
          'Fee balance for service must be great than 0'
        ).to.be.gt(0);
      });
    });
  });
});
