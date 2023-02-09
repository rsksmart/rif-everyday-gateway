import { expect } from 'chairc';
import hre, { ethers } from 'hardhat';
import { deployContract } from 'utils/deployment.utils';
import {
  IFeeManager,
  IGatewayAccessControl,
  IRIFGateway,
  LendingService,
} from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployRIFGateway } from 'test/services/utils';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { tropykusFixture } from '../utils/tropykusFixture';
import { PaybackOption } from '../constants/service';
import { signTransactionForExecutor } from '../smartwallet/utils';

async function serviceSetUp(rifGateway: IRIFGateway, consume = true) {
  const [owner, beneficiary] = await ethers.getSigners();
  const { smartWalletFactory } = await smartwalletFactoryFixture();
  const { privateKey, externalWallet } = await externalSmartwalletFixture(
    smartWalletFactory,
    owner
  );

  const { crbtc, comptroller } = await tropykusFixture();

  const { contract: tropykusLendingService } =
    await deployContract<LendingService>('TropykusLendingService', {
      gateway: rifGateway.address,
      smartWalletFactory: smartWalletFactory.address,
      contracts: {
        comptroller,
        crbtc,
        oracle: ethers.constants.AddressZero,
        cdoc: ethers.constants.AddressZero,
      },
    });

  await (await rifGateway.addService(tropykusLendingService.address)).wait();

  const listingId0 = 0;

  await (
    await tropykusLendingService.addListing({
      id: listingId0,
      minAmount: ethers.utils.parseEther('0.0001'),
      maxAmount: ethers.utils.parseEther('0.5'),
      minDuration: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.05'), // 5%
      collateralCurrency: ethers.constants.AddressZero,
      currency: ethers.constants.AddressZero,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Lending Service',
      owner: owner.address,
    })
  ).wait();

  if (consume) {
    const mtxForLending = await signTransactionForExecutor(
      externalWallet.address,
      privateKey,
      tropykusLendingService.address,
      smartWalletFactory,
      hre.network.config.chainId
    );

    await (
      await tropykusLendingService
        .connect(externalWallet)
        .lend(mtxForLending, 0, listingId0, beneficiary.address, {
          value: ethers.utils.parseEther('0.0001'),
          gasLimit: 5000000,
        })
    ).wait();
  }

  return {
    externalWallet,
    privateKey,
    tropykusLendingService,
    smartWalletFactory,
    listingId0,
    beneficiary,
  };
}

enum FeeManagerEvents {
  ServiceConsumptionFee = 'ServiceConsumptionFee',
  FeePayment = 'FeePayment',
  Withdraw = 'Withdraw',
}

const ONE_GWEI = 1000000000;

describe('FeeManager', () => {
  let feeManager: IFeeManager;
  let beneficiary: SignerWithAddress;
  let serviceProvider: SignerWithAddress;
  let financialOperator: SignerWithAddress;
  let financialOwner: SignerWithAddress;
  let owner: SignerWithAddress;
  let beneficiaryAddr: string;
  let gatewayAccessControl: IGatewayAccessControl;
  let rifGateway: IRIFGateway;

  beforeEach(async () => {
    ({
      RIFGateway: rifGateway,
      gatewayAccessControl: gatewayAccessControl,
      feeManager,
    } = await deployRIFGateway(true));
    [owner, beneficiary, financialOperator, financialOwner] =
      await ethers.getSigners();
    beneficiaryAddr = beneficiary.address;

    await (
      await gatewayAccessControl.addFinancialOwner(financialOwner.address)
    ).wait();
    await (
      await gatewayAccessControl.addFinancialOperator(financialOperator.address)
    ).wait();
  });

  it('should allow FINANCIAL_OWNER to set RIFGateway address', async () => {
    await (
      await feeManager.connect(financialOwner).setRIFGateway(rifGateway.address)
    ).wait();

    expect(await feeManager.getRIFGateway()).to.equal(rifGateway.address);
  });

  it('should not allow non-FINANCIAL_OWNER to set RIFGateway address', async () => {
    await expect(
      feeManager.connect(owner).setRIFGateway(rifGateway.address)
    ).to.be.rejectedWith('Not FINANCIAL_OWNER role');
  });

  describe('Roles', () => {
    it('should set FeeManager address as gatewayFeesOwner', async () => {
      expect(await feeManager.getGatewayFeesOwner()).to.equal(
        feeManager.address
      );
    });

    it('should transfer ownership to the given address', async () => {
      await (
        await feeManager
          .connect(owner)
          .transferOwnership(financialOwner.address)
      ).wait();

      expect(await feeManager.owner()).to.equal(financialOwner.address);
      expect(
        await gatewayAccessControl.isFinancialOwner(financialOwner.address)
      ).to.be.true;
      expect(await gatewayAccessControl.isFinancialOwner(owner.address)).to.be
        .false;
    });
    it('should revert if trying to transfer ownership to address zero', async () => {
      await expect(
        feeManager
          .connect(owner)
          .transferOwnership(ethers.constants.AddressZero)
      ).to.eventually.be.rejectedWith('Ownable: new owner is address zero');
    });
    it('should revert if trying to transfer ownership to old owner', async () => {
      await expect(
        feeManager.connect(owner).transferOwnership(owner.address)
      ).to.eventually.be.rejectedWith('NewOwnerIsCurrentOwner()');
    });
  });

  describe('getBeneficiaryFunds', () => {
    it('should get return the fees for the given beneficiary', async () => {
      const expectedFee = 0;
      await expect(feeManager.getBalance(beneficiaryAddr)).to.eventually.equal(
        expectedFee
      );
    });
  });

  describe('fundBeneficiary', () => {
    beforeEach(async () => {
      await (
        await feeManager
          .connect(financialOwner)
          .setRIFGateway(rifGateway.address)
      ).wait();
    });

    it('should add the given fees to the given beneficiary', async () => {
      const {
        externalWallet,
        privateKey,
        tropykusLendingService,
        smartWalletFactory,
        listingId0,
      } = await serviceSetUp(rifGateway, false);

      const mtxForLending = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusLendingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );
      const expectedFee = ONE_GWEI;

      // Unit under test
      await expect(
        await tropykusLendingService
          .connect(externalWallet)
          .lend(mtxForLending, 0, listingId0, externalWallet.address, {
            value: ethers.utils.parseEther('0.0001'),
            gasLimit: 5000000,
          })
      )
        .to.emit(feeManager, FeeManagerEvents.ServiceConsumptionFee)
        .withArgs(
          tropykusLendingService.address,
          expectedFee,
          externalWallet.address,
          expectedFee
        );

      // Verify results
      await expect(
        feeManager.getDebtBalanceFor(
          tropykusLendingService.address,
          externalWallet.address
        )
      ).to.eventually.equal(expectedFee);

      await expect(
        feeManager.getDebtBalance(tropykusLendingService.address)
      ).to.eventually.equal(expectedFee * 2);
    });

    it('should emit `FeePayment` event', async () => {
      const expectedFee = ONE_GWEI;
      const { tropykusLendingService } = await serviceSetUp(rifGateway);

      // Verify results
      await expect(
        feeManager.payInBehalfOf(tropykusLendingService.address, {
          value: expectedFee,
          gasLimit: 30000000,
        })
      )
        .to.emit(feeManager, FeeManagerEvents.FeePayment)
        .withArgs(
          tropykusLendingService.address,
          beneficiary.address,
          expectedFee
        );
    });

    it('should revert when the caller sends an invalid value', async () => {
      await expect(feeManager.pay()).to.have.rejectedWith('InvalidAmount');
    });

    it('should revert when the caller has no pending fees to pay', async () => {
      await expect(feeManager.pay({ value: 1 })).to.have.rejectedWith(
        'NoPendingFees'
      );
    });
  });

  describe('withdraw', () => {
    let feeManagerAsBeneficiary: IFeeManager;
    let feeManagerAsServiceProvider: IFeeManager;
    let tropykusLendingService: LendingService;

    beforeEach(async () => {
      feeManagerAsBeneficiary = feeManager.connect(beneficiary);
      feeManagerAsServiceProvider = feeManager.connect(serviceProvider);
      await (
        await feeManager
          .connect(financialOwner)
          .setRIFGateway(rifGateway.address, { gasLimit: 3000000 })
      ).wait();

      ({ tropykusLendingService } = await serviceSetUp(rifGateway));

      await (
        await feeManager.payInBehalfOf(tropykusLendingService.address, {
          value: ONE_GWEI * 2,
          gasLimit: 30000000,
        })
      ).wait();
    });

    it('should let caller withdraw their funds', async () => {
      // SetUp
      const amountToWithdraw = ONE_GWEI / 2;
      const expectedLeftBalance = ONE_GWEI - amountToWithdraw;
      // Unit under test
      await feeManagerAsBeneficiary.withdraw(
        amountToWithdraw,
        beneficiary.address
      );
      // Verify results
      await expect(feeManager.getBalance(beneficiaryAddr)).to.eventually.equal(
        expectedLeftBalance
      );
    });

    it('should revert if for feeOwner msg.sender is not FINANCIAL_OPERATOR', async () => {
      const gatewayFeesOwner = await feeManager.getGatewayFeesOwner();
      await expect(
        feeManager.connect(beneficiary).withdraw(ONE_GWEI, gatewayFeesOwner)
      ).to.eventually.be.rejectedWith('Not FINANCIAL_OPERATOR role');
    });

    it('should let FINANCIAL_OPERATOR withdraw feeOwner funds', async () => {
      // SetUp
      const gatewayFeesOwner = await feeManager.getGatewayFeesOwner();
      const amountToWithdrawAsEthers = ONE_GWEI;
      const gasEstimated = await feeManager
        .connect(financialOperator)
        .estimateGas.withdraw(amountToWithdrawAsEthers, gatewayFeesOwner);
      const gasPrice = await ethers.provider.getGasPrice();
      const gasCost = gasEstimated.mul(gasPrice);
      const financialOperatorBalanceBefore = await ethers.provider.getBalance(
        financialOperator.address
      );
      expect(financialOperatorBalanceBefore).to.equal(
        ethers.utils.parseEther('100000000000000000000000000') // hardhat initial account balance
      );

      // Unit under test
      await feeManager
        .connect(financialOperator)
        .withdraw(amountToWithdrawAsEthers, gatewayFeesOwner);
      // Verify results
      expect(await feeManager.getBalance(gatewayFeesOwner)).to.equal(0);
      expect(await ethers.provider.getBalance(feeManager.address)).to.equal(
        ONE_GWEI
      );
      const financialOperatorBalanceAfter = await ethers.provider.getBalance(
        financialOperator.address
      );

      const result = financialOperatorBalanceBefore
        .sub(gasCost)
        .add(amountToWithdrawAsEthers);

      expect(financialOperatorBalanceAfter).to.gte(result);
      expect(
        await feeManager.getDebtBalance(tropykusLendingService.address)
      ).to.equal(0);
    });

    it('should emit `Withdraw` event', async () => {
      const amountToWithdraw = ONE_GWEI;
      // Verify results
      await expect(
        feeManagerAsBeneficiary.withdraw(amountToWithdraw, beneficiary.address)
      )
        .to.emit(feeManager, FeeManagerEvents.Withdraw)
        .withArgs(beneficiaryAddr, amountToWithdraw);
    });

    it('should revert when caller does not have enough funds', async () => {
      const invalidAmountToWithdraw = ethers.utils.parseEther('50');
      // Unit under test & Verify results
      await expect(
        feeManagerAsBeneficiary.withdraw(
          invalidAmountToWithdraw,
          beneficiary.address
        )
      ).to.have.rejectedWith('InsufficientFunds');
    });

    // TODO: Create a mock contract to test fund transfer failure
    it.skip('should revert when caller does not have enough funds', async () => {
      // SetUp
      const amountToWithdraw = 50;
      // Unit under test & Verify results
      await expect(
        feeManager
          .connect(beneficiary)
          .withdraw(amountToWithdraw, beneficiary.address)
      ).to.have.rejectedWith('RBTCTransferFailed');
    });
  });
});
