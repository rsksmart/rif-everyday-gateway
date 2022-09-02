import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContract, Factory } from 'utils/deployment.utils';
import { IFeeManager } from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

async function feeManagerSetUp() {
  const { contract: feeManager, signers } = await deployContract<IFeeManager>(
    'FeeManager',
    {},
    (await ethers.getContractFactory('FeeManager', {})) as Factory<IFeeManager>
  );

  return { feeManager, signers };
}

enum FeeManagerEvents {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
}

describe('FeeManager', () => {
  let feeManager: IFeeManager;
  let signers: SignerWithAddress[];
  let beneficiary: SignerWithAddress;
  let beneficiaryAddr: string;

  beforeEach(async () => {
    ({ feeManager, signers } = await loadFixture(feeManagerSetUp));
    [, beneficiary] = signers;
    beneficiaryAddr = beneficiary.address;
  });

  describe('getBeneficiaryFunds', () => {
    it('it should get return the fees for the given beneficiary', async () => {
      const expectedFee = 0;
      await expect(feeManager.getBalance(beneficiaryAddr)).to.eventually.equal(
        expectedFee
      );
    });
  });

  describe('fundBeneficiary', () => {
    it('it should add the given fees to the given beneficiary', async () => {
      const expectedFee = 100;

      // Unit under test
      await feeManager.fundBeneficiary(beneficiaryAddr, { value: expectedFee });

      // Verify results
      await expect(feeManager.getBalance(beneficiaryAddr)).to.eventually.equal(
        expectedFee
      );
    });

    it('should emit `Deposit` event', async () => {
      const expectedFee = 100;
      // Verify results
      await expect(
        feeManager.fundBeneficiary(beneficiaryAddr, { value: expectedFee })
      )
        .to.emit(feeManager, FeeManagerEvents.Deposit)
        .withArgs(beneficiaryAddr, expectedFee);
    });

    it('should revert when the caller sends an invalid value', async () => {
      await expect(
        feeManager.fundBeneficiary(beneficiaryAddr)
      ).to.have.rejectedWith('InvalidAmount');
    });
  });

  describe('withdraw', () => {
    let feeManagerAsBeneficiary: IFeeManager;

    beforeEach(() => {
      feeManagerAsBeneficiary = feeManager.connect(beneficiary);
    });

    it('should let caller withdraw their funds', async () => {
      // SetUp
      const initialBalance = 50;
      const amountToWithdraw = 30;
      const expectedLeftBalance = initialBalance - amountToWithdraw;

      await feeManager.fundBeneficiary(beneficiaryAddr, {
        value: initialBalance,
      });

      // Unit under test
      await feeManagerAsBeneficiary.withdraw(amountToWithdraw);

      // Verify results
      await expect(feeManager.getBalance(beneficiaryAddr)).to.eventually.equal(
        expectedLeftBalance
      );
    });

    it('should emit `Withdraw` event', async () => {
      const initialBalance = 50;
      const amountToWithdraw = 30;

      await feeManager.fundBeneficiary(beneficiaryAddr, {
        value: initialBalance,
      });

      // Verify results
      await expect(feeManagerAsBeneficiary.withdraw(amountToWithdraw))
        .to.emit(feeManager, FeeManagerEvents.Withdraw)
        .withArgs(beneficiaryAddr, amountToWithdraw);
    });

    it('should revert when caller does not have enough funds', async () => {
      const invalidAmountToWithdraw = 50;

      // Unit under test & Verify results
      await expect(
        feeManager.connect(beneficiary).withdraw(invalidAmountToWithdraw)
      ).to.have.rejectedWith('InsufficientFunds');
    });

    // TODO: Create a mock contract to test fund transfer failure
    it.skip('should revert when caller does not have enough funds', async () => {
      // SetUp
      const amountToWithdraw = 50;

      await feeManager.fundBeneficiary(beneficiaryAddr, {
        value: amountToWithdraw,
      });

      // Unit under test & Verify results
      await expect(
        feeManager.connect(beneficiary).withdraw(amountToWithdraw)
      ).to.have.rejectedWith('RBTCTransferFailed');
    });
  });
});
