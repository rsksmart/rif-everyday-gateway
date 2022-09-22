import { expect } from 'chairc';
import { getFunctionSelector, MockContract } from 'test/utils/mock.utils';
import {
  ACME,
  UserIdentity,
  IUserIdentityFactory,
  IUserIdentityACL,
} from 'typechain-types';
import { userIdentityFixture } from './fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

describe('UserIdentity', () => {
  let userIdentity: UserIdentity;
  let userIdentityACLMock: MockContract<IUserIdentityACL>;
  let mockTargetContract: MockContract<ACME>;
  let signers: SignerWithAddress[];
  let user: SignerWithAddress;
  let serviceProvider: SignerWithAddress;

  beforeEach(async () => {
    ({ userIdentity, userIdentityACLMock, user, mockTargetContract, signers } =
      await loadFixture(userIdentityFixture));
    [serviceProvider] = signers;
  });

  describe('send', () => {
    it('should execute the given function in the target contract with the given payload', async () => {
      await mockTargetContract.mock['deposit()'].returns();
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(true);
      await expect(
        userIdentity.callStatic.send(
          mockTargetContract.address,
          getFunctionSelector('deposit()')
        )
      ).to.eventually.true;
    });

    it('should revert if the given function in the target contract reverts', async () => {
      await mockTargetContract.mock['deposit()'].revertsWithReason(
        'Something bad happened'
      );
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(true);
      await expect(
        userIdentity.callStatic.send(
          mockTargetContract.address,
          getFunctionSelector('deposit()')
        )
      ).to.have.rejectedWith('UnexpectedError');
    });

    it('should revert if the caller is not allowed', async () => {
      await mockTargetContract.mock['deposit()'].returns();
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(false);
      await expect(
        userIdentity.send(
          mockTargetContract.address,
          getFunctionSelector('deposit()')
        )
      ).to.have.rejectedWith('CallerNotAllowed');
    });
  });

  // TODO: Fix this test block once fixes in the contract are applied
  describe.skip('retrieve', () => {
    it('should execute the given function in the target contract with the given payload', async () => {
      await mockTargetContract.mock['withdraw()'].returns();
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(true);
      await expect(
        userIdentity.retrieve(
          mockTargetContract.address,
          getFunctionSelector('withdraw()')
        )
      ).to.eventually.true;
    });

    it('should revert if the given function in the target contract reverts', async () => {
      await mockTargetContract.mock['withdraw()'].revertsWithReason(
        'Something bad happened'
      );
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(true);
      await expect(
        userIdentity.callStatic.retrieve(
          mockTargetContract.address,
          getFunctionSelector('withdraw()')
        )
      ).to.have.rejectedWith('UnexpectedError');
    });

    it('should revert if the caller is not allowed', async () => {
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(false);
      await expect(
        userIdentity.send(
          mockTargetContract.address,
          getFunctionSelector('deposit()')
        )
      ).to.have.rejectedWith('CallerNotAllowed');
    });
  });

  describe('read', () => {
    const expectedBalance = 100;
    const expectedCollateralEarning = 5;
    const abiCoder = new ethers.utils.AbiCoder();

    it('should execute the given function in the target contract with the given payload', async () => {
      await mockTargetContract.mock['getBalance()'].returns(100, 5);
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(true);
      const data = await userIdentity.read(
        mockTargetContract.address,
        getFunctionSelector('getBalance()')
      );

      expect([
        BigNumber.from(expectedBalance),
        BigNumber.from(expectedCollateralEarning),
      ]).to.deep.equal(abiCoder.decode(['uint', 'uint'], data));
    });

    it('should revert if the caller is not allowed', async () => {
      await userIdentityACLMock.mock[
        'isAllowedToExecuteCallFor(address,address)'
      ]
        .withArgs(user.address, serviceProvider.address)
        .returns(false);
      await expect(
        userIdentity.send(
          mockTargetContract.address,
          getFunctionSelector('getBalance()')
        )
      ).to.have.rejectedWith('CallerNotAllowed');
    });
  });
});
