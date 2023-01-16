import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  IFeeManager,
  IRIFGateway,
  SmartWalletFactory,
  LendingService,
  ERC20,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { signTransactionForExecutor } from '../smartwallet/utils';
import { Wallet } from 'ethers';
import { tropykusFixture } from 'test/utils/tropykusFixture';
import { PaybackOption } from '../constants/service';
import { deployRIFGateway } from './utils';
import { deployContract } from '../../utils/deployment.utils';

describe('Tropykus Lending Service', () => {
  let owner: SignerWithAddress;
  let tropykusLendingService: LendingService;
  let smartWalletFactory: SmartWalletFactory;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let crbtc: string;
  let comptroller: string;
  let doc: ERC20;
  let docAddr: string;
  let feeManager: IFeeManager;
  let RIFGateway: IRIFGateway;

  let cdoc: string;

  before(async () => {
    [owner] = await ethers.getSigners();

    ({ smartWalletFactory } = await smartwalletFactoryFixture());
    ({ crbtc, comptroller, doc: docAddr, cdoc } = await tropykusFixture());
  });

  beforeEach(async () => {
    ({ RIFGateway: RIFGateway, feeManager: feeManager } =
      await deployRIFGateway());

    ({ contract: tropykusLendingService } =
      await deployContract<LendingService>('TropykusLendingService', {
        gateway: RIFGateway.address,
        smartWalletFactory: smartWalletFactory.address,
        contracts: {
          comptroller,
          crbtc,
          oracle: ethers.constants.AddressZero,
          cdoc: ethers.constants.AddressZero,
        },
      }));

    await (await RIFGateway.addService(tropykusLendingService.address)).wait();

    ({ privateKey, externalWallet } = await externalSmartwalletFixture(
      smartWalletFactory,
      owner
    ));

    doc = (await ethers.getContractAt('ERC20', docAddr, owner)) as ERC20;
    await doc.transfer(externalWallet.address, ethers.utils.parseEther('5'));
  });

  it('should retrieve service name', async () => {
    const lendingService = await ethers.getContractAt(
      'LendingService',
      tropykusLendingService.address,
      owner
    );

    const name = await lendingService.serviceProviderName();
    expect(name).equals('Tropykus');
  });

  describe('Lend/Withdraw', () => {
    beforeEach(async () => {
      await (
        await tropykusLendingService.addListing({
          id: 0,
          minAmount: ethers.utils.parseEther('0.0001'),
          maxAmount: ethers.utils.parseEther('0.5'),
          minDuration: 0,
          maxDuration: 0,
          interestRate: ethers.utils.parseEther('0.05'), // 5%
          loanToValueCurrency: ethers.constants.AddressZero,
          currency: ethers.constants.AddressZero,
          payBackOption: PaybackOption.Day,
          enabled: true,
          name: 'Tropykus Lending Service',
          owner: owner.address,
        })
      ).wait();

      await (
        await tropykusLendingService.addListing({
          id: 1,
          minAmount: ethers.utils.parseUnits('1', 18),
          maxAmount: ethers.utils.parseUnits('10', 18),
          minDuration: 0,
          maxDuration: 0,
          interestRate: ethers.utils.parseEther('0.05'), // 5%
          loanToValueCurrency: ethers.constants.AddressZero,
          currency: doc.address,
          payBackOption: PaybackOption.Day,
          enabled: true,
          name: 'Tropykus Lending Service',
          owner: owner.address,
        })
      ).wait();
    });

    it('should allow to lend RBTC on tropykus', async () => {
      const amountToLend = 0.0001;
      const mtx = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      const beforeLiquidity = await tropykusLendingService
        .connect(externalWallet)
        .currentLiquidity(0);

      const tx1 = await tropykusLendingService
        .connect(externalWallet)
        .lend(mtx, 0, 0, ethers.constants.AddressZero, {
          value: ethers.utils.parseEther(amountToLend.toString()),
          gasLimit: 5000000,
        });
      await tx1.wait();

      const afterLiquidity = await tropykusLendingService
        .connect(externalWallet)
        .currentLiquidity(0);

      expect(amountToLend).to.be.closeTo(
        +beforeLiquidity / 1e18 - +afterLiquidity / 1e18,
        0.0001
      );

      const tropBalance = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(ethers.constants.AddressZero, { gasLimit: 3000000 });

      expect(+tropBalance / 1e18).to.be.closeTo(0.0001, 0.001);
    });

    it('should allow to lend DOC on tropykus', async () => {
      const amountToLend = 2;
      const smartWalletAddr = await smartWalletFactory.getSmartWalletAddress(
        externalWallet.address
      );
      const mtx = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      const beforeLiquidity = await tropykusLendingService
        .connect(externalWallet)
        .currentLiquidity(1);

      await (
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddr, ethers.utils.parseEther(amountToLend.toString()), {
            gasLimit: 300000,
          })
      ).wait();

      const lendTx = await tropykusLendingService
        .connect(externalWallet)
        .lend(
          mtx,
          ethers.utils.parseEther(amountToLend.toString()),
          1,
          ethers.constants.AddressZero,
          {
            gasLimit: 5000000,
          }
        );
      await lendTx.wait();

      const afterLiquidity = await tropykusLendingService
        .connect(externalWallet)
        .currentLiquidity(1);

      expect(amountToLend).to.be.closeTo(
        +beforeLiquidity / 1e18 - +afterLiquidity / 1e18,
        0.1
      );

      const tropBalance = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(doc.address, { gasLimit: 3000000 });

      expect(+tropBalance / 1e18).to.be.closeTo(amountToLend, 0.1);
    });

    it('should allow to withdraw RBTC on tropykus', async () => {
      const mtxForLending = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      const lendTx = await tropykusLendingService
        .connect(externalWallet)
        .lend(mtxForLending, 0, 0, ethers.constants.AddressZero, {
          value: ethers.utils.parseEther('0.0001'),
          gasLimit: 5000000,
        });

      await lendTx.wait();

      const balanceTroBefore = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(ethers.constants.AddressZero);

      expect(+balanceTroBefore / 1e18).to.be.closeTo(0.0001, 0.001);

      const mtxForWithdrawal = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      const withdrawTx = await tropykusLendingService
        .connect(externalWallet)
        .withdraw(mtxForWithdrawal, 0, {
          gasLimit: 3000000,
        });

      await withdrawTx.wait();

      const balanceTropAfter = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(ethers.constants.AddressZero);

      expect(+balanceTropAfter / 1e18).to.be.equals(0);

      expect(
        await feeManager.getDebtBalance(tropykusLendingService.address)
      ).to.be.gt(0);
    });

    it('should allow to withdraw DOC on tropykus', async () => {
      const amountToLend = 2;
      const smartWalletAddr = await smartWalletFactory.getSmartWalletAddress(
        externalWallet.address
      );
      const mtx = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      await (
        await doc
          .connect(externalWallet)
          .approve(smartWalletAddr, ethers.utils.parseEther(amountToLend.toString()), {
            gasLimit: 300000,
          })
      ).wait();

      const lendTx = await tropykusLendingService
        .connect(externalWallet)
        .lend(
          mtx,
          ethers.utils.parseEther(amountToLend.toString()),
          1,
          ethers.constants.AddressZero,
          {
            gasLimit: 5000000,
          }
        );
      await lendTx.wait();

      const balanceTropBefore = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(doc.address);

      expect(+balanceTropBefore / 1e18).to.be.equals(2);

      const mtxForWithdrawal = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

      const withdrawTx = await tropykusLendingService
        .connect(externalWallet)
        .withdraw(mtxForWithdrawal, 1, {
          gasLimit: 3000000,
        });

      await withdrawTx.wait();

      const balanceTropAfter = await tropykusLendingService
        .connect(externalWallet)
        .getBalance(doc.address);

      expect(+balanceTropAfter / 1e18).to.be.equals(0);

      expect(
        await feeManager.getDebtBalance(tropykusLendingService.address)
      ).to.be.gt(0);
    });
  });
});
