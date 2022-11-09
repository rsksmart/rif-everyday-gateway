import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  SmartWallet,
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
  let smartWallet: SmartWallet;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;

  let crbtc: string;
  const crbtcTestnet = '0x5b35072cd6110606c8421e013304110fa04a32a3';
  const localPrivateKeys = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ];
  const testnetPrivateKeys = [
    '0x9d9f047a66ce8e3c3df5c55fd4f7eb3d204989b34bdcf5cc16a9eeef937f8c31',
    '0x866edc99429101d2a2194702b82deeb59c4e29a37e0c2d704471d59b223c012b',
    '0xcc412ab8f588073e5cd58877e3fe8656f622f186b848f880095e938164ba79f1',
  ];

  const onTestnet = hre.network.config.chainId === 31;
  console.log('onTestnet', onTestnet);

  before(async () => {
    ({ smartWalletFactory, signers } = await smartwalletFactoryFixture());
    // console.log('smartWalletFactory', smartWalletFactory.address);
  });

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    ({ smartWallet, privateKey, externalWallet } =
      await externalSmartwalletFixture(
        smartWalletFactory,
        signers,
        onTestnet,
        onTestnet ? testnetPrivateKeys : localPrivateKeys
      ));
    // console.log('smartWallet', smartWallet.address);

    ({ crbtc: crbtc } = await tropykusFixture());

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory.deploy(
      onTestnet ? crbtcTestnet : crbtc,
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
