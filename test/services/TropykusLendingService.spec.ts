import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  IFeeManager,
  IRIFGateway,
  SmartWalletFactory,
  LendingService,
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
  let feeManager: IFeeManager;
  let RIFGateway: IRIFGateway;

  before(async () => {
    [owner] = await ethers.getSigners();

    ({ smartWalletFactory } = await smartwalletFactoryFixture());
    ({ crbtc, comptroller } = await tropykusFixture());

    ({ privateKey, externalWallet } = await externalSmartwalletFixture(
      smartWalletFactory,
      owner
    ));
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
        },
      }));

    await (await RIFGateway.addService(tropykusLendingService.address)).wait();
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

      console.log(balanceTroBefore);

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
  });
});
