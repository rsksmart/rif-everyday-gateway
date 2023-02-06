import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContract, Factory } from 'utils/deployment.utils';
import { FeeManager } from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

async function feeManagerSetUp() {
  const [feesOwner] = await ethers.getSigners();
  const { contract: feeManager, signers } = await deployContract<FeeManager>(
    'FeeManager',
    { feesOwner: feesOwner.address },
    (await ethers.getContractFactory('FeeManager', {})) as Factory<FeeManager>
  );

  return { feeManager, signers };
}

enum FeeManagerEvents {
  ServiceConsumptionFee = 'ServiceConsumptionFee',
  FeePayment = 'FeePayment',
  Withdraw = 'Withdraw',
}

const ONE_GWEI = 1000000000;

describe('FeeManager', () => {
  let feeManager: FeeManager;
  let signers: SignerWithAddress[];
  let beneficiary: SignerWithAddress;
  let serviceProvider: SignerWithAddress;
  let financialOperator: SignerWithAddress;
  let financialOwner: SignerWithAddress;
  let owner: SignerWithAddress;
  let beneficiaryAddr: string;
  let serviceProviderAddr: string;
  let ownerAddr: string;

  beforeEach(async () => {
    ({ feeManager, signers } = await loadFixture(feeManagerSetUp));
    [owner, beneficiary, serviceProvider, financialOperator, financialOwner] =
      signers;
    beneficiaryAddr = beneficiary.address;
    serviceProviderAddr = serviceProvider.address;
    ownerAddr = owner.address;
  });

  describe('Roles', () => {
    it('should set deployer as OWNER', async () => {
      expect(await feeManager.isOwner(owner.address)).to.be.true;
    });
    it('should set deployer as FINANCIAL_OWNER', async () => {
      expect(await feeManager.isFinancialOwner(owner.address)).to.be.true;
    });
    it('should transfer ownership to the given address', async () => {
      expect(await feeManager.owner()).to.equal(owner.address);
      expect(await feeManager.isOwner(owner.address)).to.be.true;
      expect(await feeManager.isFinancialOwner(owner.address)).to.be.true;

      await (
        await feeManager
          .connect(owner)
          .transferOwnership(financialOwner.address)
      ).wait();

      expect(await feeManager.owner()).to.equal(financialOwner.address);
      expect(await feeManager.isOwner(owner.address)).to.be.true;
      expect(await feeManager.isFinancialOwner(financialOwner.address)).to.be
        .true;
      expect(await feeManager.isFinancialOwner(owner.address)).to.be.false;
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
    it('should add the given fees to the given beneficiary', async () => {
      const expectedFee = ONE_GWEI;

      // Unit under test
      await expect(feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr))
        .to.emit(feeManager, FeeManagerEvents.ServiceConsumptionFee)
        .withArgs(
          serviceProviderAddr,
          expectedFee,
          beneficiaryAddr,
          expectedFee
        );

      // Verify results
      await expect(
        feeManager.getDebtBalanceFor(serviceProviderAddr, beneficiaryAddr)
      ).to.eventually.equal(expectedFee);

      await expect(
        feeManager.getDebtBalance(serviceProviderAddr)
      ).to.eventually.equal(expectedFee * 2);
    });

    it('should emit `FeePayment` event', async () => {
      const expectedFee = ONE_GWEI;
      await feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr);
      // Verify results
      await expect(
        feeManager
          .connect(serviceProvider)
          .pay({ value: expectedFee, gasLimit: 30000000 })
      )
        .to.emit(feeManager, FeeManagerEvents.FeePayment)
        .withArgs(serviceProviderAddr, beneficiaryAddr, expectedFee);
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
    let feeManagerAsBeneficiary: FeeManager;
    let feeManagerAsServiceProvider: FeeManager;

    beforeEach(async () => {
      feeManagerAsBeneficiary = feeManager.connect(beneficiary);
      feeManagerAsServiceProvider = feeManager.connect(serviceProvider);
      await (
        await feeManager
          .connect(owner)
          .addFinancialOperator(financialOperator.address)
      ).wait();
    });

    it('should let caller withdraw their funds', async () => {
      // SetUp
      const initialBalance = ONE_GWEI;
      const amountToWithdraw = ONE_GWEI / 2;
      const expectedLeftBalance = initialBalance - amountToWithdraw;
      await feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr);
      await feeManagerAsServiceProvider.pay({ value: ONE_GWEI });
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

    it('should let FINANCIAL_OPERATOR withdraw feeOwner funds', async () => {
      // SetUp
      const initialBalance = ONE_GWEI;
      const amountToWithdraw = ONE_GWEI / 2;
      const expectedLeftBalance = initialBalance - amountToWithdraw;
      await feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr);
      await feeManagerAsServiceProvider.pay({ value: ONE_GWEI * 2 });
      // Unit under test owner is a FINANCIAL_OPERATOR
      // TODO transfer fund to address of FINANCIAL_OPERATOR
      await feeManager
        .connect(financialOperator)
        .withdraw(amountToWithdraw, ownerAddr);
      // Verify results
      await expect(feeManager.getBalance(ownerAddr)).to.eventually.equal(
        expectedLeftBalance
      );
    });

    it('should emit `Withdraw` event', async () => {
      const amountToWithdraw = ONE_GWEI;
      await feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr);
      await feeManagerAsServiceProvider.pay({ value: ONE_GWEI });
      // Verify results
      await expect(
        feeManagerAsBeneficiary.withdraw(amountToWithdraw, beneficiary.address)
      )
        .to.emit(feeManager, FeeManagerEvents.Withdraw)
        .withArgs(beneficiaryAddr, amountToWithdraw);
    });

    it('should revert when caller does not have enough funds', async () => {
      const invalidAmountToWithdraw = 50;
      // Unit under test & Verify results
      await expect(
        feeManager
          .connect(beneficiary)
          .withdraw(invalidAmountToWithdraw, beneficiary.address)
      ).to.have.rejectedWith('InsufficientFunds');
    });

    // TODO: Create a mock contract to test fund transfer failure
    it.skip('should revert when caller does not have enough funds', async () => {
      // SetUp
      const amountToWithdraw = 50;
      await feeManager.chargeFee(serviceProviderAddr, beneficiaryAddr);
      await feeManagerAsServiceProvider.pay({ value: ONE_GWEI });
      // Unit under test & Verify results
      await expect(
        feeManager
          .connect(beneficiary)
          .withdraw(amountToWithdraw, beneficiary.address)
      ).to.have.rejectedWith('RBTCTransferFailed');
    });
  });
});
