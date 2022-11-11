import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  SmartWalletFactory,
  TropykusLendingService,
  TropykusLendingService__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { signTransactionForExecutor } from '../smartwallet/utils';
import { Wallet } from 'ethers';
import { tropykusFixture } from 'test/utils/tropykusFixture';

describe('Tropykus Lending Service', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let tropykusLendingService: TropykusLendingService;
  let smartWalletFactory: SmartWalletFactory;
  let signers: SignerWithAddress[];
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let crbtc: string;

  before(async () => {
    ({ smartWalletFactory, signers } = await smartwalletFactoryFixture());
    // console.log('smartWalletFactory', smartWalletFactory.address);
  });

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    ({ privateKey, externalWallet } = await externalSmartwalletFixture(
      smartWalletFactory,
      signers
    ));
    // console.log('externalWallet', externalWallet.address);

    ({ crbtc: crbtc } = await tropykusFixture());

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory.deploy(
      crbtc,
      smartWalletFactory.address
    )) as TropykusLendingService;

    await tropykusLendingService.deployed();
    // console.log('tropykusLendingService', tropykusLendingService.address);
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

  it('should allow to lend RBTC on tropykus', async () => {
    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    const tx1 = await tropykusLendingService
      .connect(externalWallet)
      .lend(suffixData, forwardRequest, signature, {
        value: ethers.utils.parseEther('0.0001'),
        gasLimit: 3000000,
      });
    await tx1.wait();

    const tropBalance = await tropykusLendingService
      .connect(externalWallet)
      .getBalance(ethers.constants.AddressZero, { gasLimit: 3000000 });

    expect(+tropBalance / 1e18).to.be.closeTo(0.0001, 0.001);
  });

  it('should allow to withdraw RBTC on tropykus', async () => {
    const {
      forwardRequest: forwardRequest1,
      suffixData: suffixData1,
      signature: signature1,
    } = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusLendingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    const lendTx = await tropykusLendingService
      .connect(externalWallet)
      .lend(suffixData1, forwardRequest1, signature1, {
        value: ethers.utils.parseEther('0.0001'),
        gasLimit: 3000000,
      });

    await lendTx.wait();

    const balanceTroBefore = await tropykusLendingService
      .connect(externalWallet)
      .getBalance(ethers.constants.AddressZero);

    expect(+balanceTroBefore / 1e18).to.be.closeTo(0.0001, 0.001);

    const {
      forwardRequest: forwardRequest2,
      suffixData: suffixData2,
      signature: signature2,
    } = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusLendingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    const withdrawTx = await tropykusLendingService
      .connect(externalWallet)
      .withdraw(suffixData2, forwardRequest2, signature2, {
        gasLimit: 3000000,
      });

    await withdrawTx.wait();

    const balanceTropAfter = await tropykusLendingService
      .connect(externalWallet)
      .getBalance(ethers.constants.AddressZero);

    expect(+balanceTropAfter / 1e18).to.be.equals(0);
  });
});
