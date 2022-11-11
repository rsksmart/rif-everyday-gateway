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
  let smartWalletAddress: string;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let doc: ERC20;
  let gasPrice: BigNumber;

  before(async () => {
    ({ smartWalletFactory, signers } = await smartwalletFactoryFixture());
    gasPrice = await ethers.provider.getGasPrice();
  });

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const tropykusContractsDeployed = await tropykusFixture();

    doc = (await ethers.getContractAt(
      'ERC20',
      tropykusContractsDeployed.doc,
      owner
    )) as ERC20;

    ({ privateKey, externalWallet } = await externalSmartwalletFixture(
      smartWalletFactory,
      signers
    ));

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory.deploy(
      smartWalletFactory.address,
      tropykusContractsDeployed
    )) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();

    smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
      externalWallet.address
    );
  });

  it('should retrieve service name', async () => {
    const borrowingService = await ethers.getContractAt(
      'BorrowService',
      tropykusBorrowingService.address,
      owner
    );

    const name = await borrowingService.serviceProviderName();
    expect(name).equals('Tropykus');
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
      doc.address,
      0, // Not in use for now
      0, // Not in use for now
      {
        value: ethers.utils.parseEther(amountToLend.toString()),
        gasLimit: 3000000,
      }
    );
    await tx.wait();

    smartWallet = (await ethers.getContractAt(
      'SmartWallet',
      smartWalletAddress,
      externalWallet
    )) as SmartWallet;

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
      doc.address,
      0, // Not in use for now
      0, // Not in use for now
      { value: amountToLend, gasLimit: 3000000 }
    );
    await tx.wait();

    smartWallet = (await ethers.getContractAt(
      'SmartWallet',
      smartWalletAddress,
      externalWallet
    )) as SmartWallet;

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
        doc.address,
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
      doc.address,
      0, // Not in use for now
      0, // Not in use for now
      { value: amountToLend, gasLimit: 3000000 }
    );
    await tx.wait();

    smartWallet = (await ethers.getContractAt(
      'SmartWallet',
      smartWalletAddress,
      externalWallet
    )) as SmartWallet;

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
        doc.address,
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
