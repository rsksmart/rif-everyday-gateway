import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  BorrowService,
  ERC20,
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
import { deployRIFGateway } from './utils';
import { Wallet } from 'ethers';
import { deployContract } from 'utils/deployment.utils';

describe('Tropykus Borrowing Service', () => {
  let owner: SignerWithAddress;
  let tropykusBorrowingService: BorrowService;
  let smartWalletFactory: SmartWalletFactory;
  let smartWalletAddress: string;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let doc: ERC20;
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
      'ERC20',
      tropykusContractsDeployed.doc,
      owner
    )) as ERC20;

    ({ RIFGateway: RIFGateway, feeManager: feeManager } =
      await deployRIFGateway());

    ({ contract: tropykusBorrowingService } =
      await deployContract<BorrowService>('TropykusBorrowingService', {
        gateway: RIFGateway.address,
        smartWalletFactory: smartWalletFactory.address,
        contracts: tropykusContractsDeployed,
      }));

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
        ethers.utils.parseEther(amountToBorrow.toString()),
        ethers.constants.AddressZero
      );

    const amountToLend = +calculateAmountToLend / 1e18;

    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusBorrowingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    await expect(
      tropykusBorrowingService.connect(externalWallet).borrow(
        suffixData,
        forwardRequest,
        signature,
        ethers.utils.parseEther(amountToBorrow.toString()),
        0, // Not in use for now
        0, // Not in use for now
        {
          value: ethers.utils.parseEther(amountToLend.toString()),
          gasLimit: 5000000,
        }
      )
    ).to.be.rejected;
  });

  describe('Borrow/Repay', () => {
    beforeEach(async () => {
      await (
        await tropykusBorrowingService.connect(owner).addListing({
          id: 0,
          minAmount: ethers.utils.parseEther('1'),
          maxAmount: ethers.utils.parseEther('100'),
          minDuration: 0,
          maxDuration: 1000,
          interestRate: ethers.utils.parseEther('0.01'), // 1%
          loanToValueCurrency: ethers.constants.AddressZero,
          currency: doc.address,
          payBackOption: PaybackOption.Day,
          enabled: true,
          name: 'Tropykus Borrow Service',
          owner: owner.address,
        })
      ).wait();
    });

    it('should allow to borrow DOC after lending RBTC on tropykus', async () => {
      const amountToBorrow = 2;

      const beforeLiquidity = await tropykusBorrowingService
        .connect(externalWallet)
        .currentLiquidity(0);

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
        0, // Not in use for now
        0, // Not in use for now
        {
          value: ethers.utils.parseEther(amountToLend.toString()),
          gasLimit: 5000000,
        }
      );
      await tx.wait();

      const afterLiquidity = await tropykusBorrowingService
        .connect(externalWallet)
        .currentLiquidity(0);

      expect(amountToBorrow).equals(
        +beforeLiquidity / 1e18 - +afterLiquidity / 1e18
      );

      const balanceTropAfter = await tropykusBorrowingService
        .connect(externalWallet)
        .getCollateralBalance();

      expect(+balanceTropAfter / 1e18).to.equal(amountToLend);

      const balance = await doc.balanceOf(smartWalletAddress);

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
        0, // Not in use for now
        0, // Not in use for now
        { value: amountToLend, gasLimit: 5000000 }
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

      const approvedValue = borrowBalancePlusCent.lt(
        docBalanceAfterWithInterest
      )
        ? borrowBalancePlusCent
        : docBalanceAfterWithInterest;

      const approveTx = await doc
        .connect(externalWallet)
        .approve(smartWalletAddress, approvedValue, { gasLimit: 300000 });
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
          0,
          {
            gasLimit: 5000000,
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
        0, // Not in use for now
        0, // Not in use for now
        { value: amountToLend, gasLimit: 5000000 }
      );
      await tx.wait();

      const docBalanceAfterBorrow = await doc.balanceOf(externalWallet.address);

      const expectedBalance = docBalanceBefore.add(amountToBorrow);

      expect(
        docBalanceAfterBorrow,
        'DOC balance after borrow equals 5 DOC'
      ).to.be.equal(expectedBalance);

      const forInterest = ethers.utils.parseEther('0.2');
      // Extra balance to pay interest $0.2
      await doc.transfer(externalWallet.address, forInterest);
      const docBalanceAfterWithInterest = await doc.balanceOf(
        externalWallet.address
      );
      expect(
        docBalanceAfterWithInterest,
        'DOC balance with interest equals 5.2 DOC'
      ).to.be.equals(docBalanceAfterBorrow.add(forInterest));

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
        .approve(smartWalletAddress, approvedValue, {
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
          0,
          { gasLimit: 5000000 }
        );
      await payTx.wait();

      const borrowBalanceAfter = await tropykusBorrowingService
        .connect(externalWallet)
        .getBalance(doc.address);

      expect(
        +borrowBalanceAfter / 1e18,
        'Borrow balance after pay equals 0'
      ).to.eq(0);

      const docBalanceAfter = await doc.balanceOf(externalWallet.address);

      expect(
        +docBalanceAfter / 1e18,
        'DOC balance after pay must be 0 +- 0.2'
      ).to.be.closeTo(
        +docBalanceAfterWithInterest / 1e18 - +borrowBalancePlusCent / 1e18,
        +forInterest / 1e18
      );

      const balanceTropBefore = await tropykusBorrowingService
        .connect(externalWallet)
        .getCollateralBalance();

      expect(
        balanceTropBefore,
        'Balance tropykus collateral after payment must be equals amount to lend'
      ).to.be.equals(amountToLend);

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
          ethers.constants.AddressZero,
          { gasLimit: 3000000 }
        );
      await withdrawTx.wait();

      const balanceTropAfter = await tropykusBorrowingService
        .connect(externalWallet)
        .getCollateralBalance();

      expect(
        +balanceTropAfter / 1e18,
        'Tropykus balance after payment must be 0'
      ).to.equal(0);

      expect(
        await feeManager.getDebtBalance(tropykusBorrowingService.address),
        'Fee balance for service must be great than 0'
      ).to.be.gt(0);
    });
  });
});
