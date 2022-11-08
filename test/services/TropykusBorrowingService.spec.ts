import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ERC20,
  SmartWallet,
  SmartWalletFactory,
  TropykusBorrowingService,
  TropykusBorrowingService__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { signTransactionForExecutor } from '../smartwallet/utils';
import { BigNumber, Wallet } from 'ethers';
import { tropykusFixture } from 'test/utils/tropykusFixture';

describe('Tropykus Borrowing Service', () => {
  let owner: SignerWithAddress;
  let tropykusBorrowingService: TropykusBorrowingService;
  let smartWalletFactory: SmartWalletFactory;
  let signers: SignerWithAddress[];
  let smartWallet: SmartWallet;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let doc: ERC20;
  let gasPrice: BigNumber;

  const tropykusContracts = {
    comptroller: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
    oracle: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    crbtc: '0x7bc06c482dead17c0e297afbc32f6e63d3846650',
    cdoc: '0x4a679253410272dd5232b3ff7cf5dbb88f295319',
  };
  const tropykusContractsTestnet = {
    comptroller: '0xb1bec5376929b4e0235f1353819dba92c4b0c6bb',
    oracle: '0x9fbB872D3B45f95b4E3126BC767553D3Fa1e31C0',
    crbtc: '0x5b35072cd6110606c8421e013304110fa04a32a3',
    cdoc: '0x71e6b108d823c2786f8ef63a3e0589576b4f3914',
  };
  const docAddress = '0x59b670e9fa9d0a427751af201d676719a970857b';
  const docAddressTestnet = '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0';
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
    gasPrice = await ethers.provider.getGasPrice();
  });

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const tropykusContractsDeployed = await tropykusFixture();

    doc = (await ethers.getContractAt(
      'ERC20',
      onTestnet ? docAddressTestnet : tropykusContractsDeployed.doc,
      owner
    )) as ERC20;

    ({ smartWallet, privateKey, externalWallet } =
      await externalSmartwalletFixture(
        smartWalletFactory,
        signers,
        onTestnet,
        onTestnet ? testnetPrivateKeys : localPrivateKeys
      ));

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory.deploy(
      smartWalletFactory.address,
      onTestnet ? tropykusContractsTestnet : tropykusContractsDeployed
    )) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();
  });

  it('should allow to borrow DOC after lending RBTC on tropykus', async () => {
    const amountToBorrow = 2;

    const calculateAmountToLend = await tropykusBorrowingService
      .connect(externalWallet)
      .calculateRequiredCollateral(
        ethers.utils.parseEther(amountToBorrow.toString()),
        ethers.constants.AddressZero
      );

    const amountToLend = +calculateAmountToLend / 1e18;

    expect(amountToLend).to.be.closeTo(0.0002, 0.0001);

    const balanceUserBefore = await doc.balanceOf(externalWallet.address);

    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusBorrowingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    const tx = await tropykusBorrowingService.connect(externalWallet).borrow(
      suffixData,
      forwardRequest,
      signature,
      ethers.utils.parseEther(amountToBorrow.toString()),
      onTestnet ? docAddressTestnet : doc.address,
      0, // Not in use for now
      0, // Not in use for now
      {
        value: ethers.utils.parseEther(amountToLend.toString()),
        gasLimit: 3000000,
      }
    );

    await tx.wait();

    const balanceTropAfter = await tropykusBorrowingService
      .connect(externalWallet)
      .getCollateralBalance();

    expect(+balanceTropAfter / 1e18).to.equal(amountToLend);

    const balance = await doc.balanceOf(smartWallet.address);

    expect(+balance / 1e18).to.equal(0);

    const balanceUserAfter = await doc.balanceOf(externalWallet.address);

    expect(+balanceUserAfter / 1e18).to.equal(
      +balanceUserBefore / 1e18 + amountToBorrow
    );
  });

  it('should allow to repay DOC debt', async () => {
    const amountToBorrow = ethers.utils.parseEther('5');

    const amountToLend = await tropykusBorrowingService
      .connect(externalWallet)
      .calculateRequiredCollateral(
        amountToBorrow,
        ethers.constants.AddressZero
      );

    const docBalanceBefore = await doc.balanceOf(externalWallet.address);

    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusBorrowingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    const tx = await tropykusBorrowingService.connect(externalWallet).borrow(
      suffixData,
      forwardRequest,
      signature,
      amountToBorrow,
      onTestnet ? docAddressTestnet : doc.address,
      0, // Not in use for now
      0, // Not in use for now
      { value: amountToLend, gasLimit: 3000000 }
    );
    await tx.wait();

    const docBalanceAfterBorrow = await doc.balanceOf(externalWallet.address);

    const expectedBalance = docBalanceBefore.add(amountToBorrow);

    expect(docBalanceAfterBorrow).to.be.equal(expectedBalance);

    const forInterest = ethers.utils.parseEther('0.2');
    // Extra balance to pay interest $0.2
    await doc.transfer(externalWallet.address, forInterest);
    const docBalanceAfterWithInterest = await doc.balanceOf(
      externalWallet.address
    );
    expect(docBalanceAfterWithInterest).to.be.equals(
      docBalanceAfterBorrow.add(forInterest)
    );

    const borrowBalance = await tropykusBorrowingService
      .connect(externalWallet)
      .getBalance(doc.address);

    const borrowBalancePlusCent = borrowBalance.add(forInterest);

    const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterWithInterest)
      ? borrowBalancePlusCent
      : docBalanceAfterWithInterest;

    const approveTx = await doc
      .connect(externalWallet)
      .approve(smartWallet.address, approvedValue, { gasLimit: 300000 });
    await approveTx.wait();

    const signedMessageForPayment = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusBorrowingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    const payTx = await tropykusBorrowingService
      .connect(externalWallet)
      .pay(
        signedMessageForPayment.suffixData,
        signedMessageForPayment.forwardRequest,
        signedMessageForPayment.signature,
        approvedValue,
        onTestnet ? docAddressTestnet : doc.address,
        0,
        {
          gasLimit: 3000000,
        }
      );
    await payTx.wait();

    const borrowBalanceAfter = await tropykusBorrowingService
      .connect(externalWallet)
      .getBalance(doc.address);
    expect(+borrowBalanceAfter / 1e18).to.eq(0);

    const docBalanceAfter = await doc.balanceOf(externalWallet.address);

    expect(+docBalanceAfter / 1e18).to.be.closeTo(
      +docBalanceAfterWithInterest / 1e18 - +borrowBalancePlusCent / 1e18,
      +forInterest / 1e18
    );
  });

  it('should allow withdraw collateral after repaying debt', async () => {
    const amountToBorrow = ethers.utils.parseEther('5');

    const amountToLend = await tropykusBorrowingService
      .connect(externalWallet)
      .calculateRequiredCollateral(
        amountToBorrow,
        ethers.constants.AddressZero
      );

    const docBalanceBefore = await doc.balanceOf(externalWallet.address);

    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusBorrowingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    const tx = await tropykusBorrowingService.connect(externalWallet).borrow(
      suffixData,
      forwardRequest,
      signature,
      amountToBorrow,
      onTestnet ? docAddressTestnet : doc.address,
      0, // Not in use for now
      0, // Not in use for now
      { value: amountToLend, gasLimit: 3000000 }
    );
    await tx.wait();

    const docBalanceAfterBorrow = await doc.balanceOf(externalWallet.address);

    const expectedBalance = docBalanceBefore.add(amountToBorrow);

    expect(docBalanceAfterBorrow).to.be.equal(expectedBalance);

    const forInterest = ethers.utils.parseEther('0.2');
    // Extra balance to pay interest $0.2
    await doc.transfer(externalWallet.address, forInterest);
    const docBalanceAfterWithInterest = await doc.balanceOf(
      externalWallet.address
    );
    expect(docBalanceAfterWithInterest).to.be.equals(
      docBalanceAfterBorrow.add(forInterest)
    );

    const borrowBalance = await tropykusBorrowingService
      .connect(externalWallet)
      .getBalance(doc.address);

    const borrowBalancePlusCent = borrowBalance.add(forInterest);

    const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterWithInterest)
      ? borrowBalancePlusCent
      : docBalanceAfterWithInterest;

    const approveTx = await doc
      .connect(externalWallet)
      .approve(smartWallet.address, approvedValue, {
        gasLimit: 300000,
      });
    await approveTx.wait();

    const signedMessageForPayment = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusBorrowingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    const payTx = await tropykusBorrowingService
      .connect(externalWallet)
      .pay(
        signedMessageForPayment.suffixData,
        signedMessageForPayment.forwardRequest,
        signedMessageForPayment.signature,
        approvedValue,
        onTestnet ? docAddressTestnet : doc.address,
        0,
        { gasLimit: 5000000 }
      );
    await payTx.wait();

    const borrowBalanceAfter = await tropykusBorrowingService
      .connect(externalWallet)
      .getBalance(doc.address);
    expect(+borrowBalanceAfter / 1e18).to.eq(0);

    const docBalanceAfter = await doc.balanceOf(externalWallet.address);

    expect(+docBalanceAfter / 1e18).to.be.closeTo(
      +docBalanceAfterWithInterest / 1e18 - +borrowBalancePlusCent / 1e18,
      +forInterest / 1e18
    );

    const balanceTropBefore = await tropykusBorrowingService
      .connect(externalWallet)
      .getCollateralBalance();
    expect(balanceTropBefore).to.be.equals(amountToLend);

    const signedMessageForWithdraw = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusBorrowingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    const withdrawTx = await tropykusBorrowingService
      .connect(externalWallet)
      .withdraw(
        signedMessageForWithdraw.suffixData,
        signedMessageForWithdraw.forwardRequest,
        signedMessageForWithdraw.signature,
        { gasLimit: 3000000 }
      );
    await withdrawTx.wait();

    const balanceTropAfter = await tropykusBorrowingService
      .connect(externalWallet)
      .getCollateralBalance();
    expect(+balanceTropAfter / 1e18).to.equal(0);
  });
});
