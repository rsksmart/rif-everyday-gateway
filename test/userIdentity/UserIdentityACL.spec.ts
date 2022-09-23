import { expect } from 'chairc';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IUserIdentityACL, UserIdentityACL } from 'typechain-types';
import { userIdentityACLFixture } from './fixtures';

describe('UserIdentityACL', () => {
  let userIdentityACL: IUserIdentityACL;
  let signers: SignerWithAddress[];
  let user: SignerWithAddress;
  let serviceProvider: SignerWithAddress;

  beforeEach(async () => {
    ({ userIdentityACL, signers } = await loadFixture(userIdentityACLFixture));
    [user, serviceProvider] = signers;
  });

  describe('authorized', () => {
    it('should authorized the caller for querying user identity', async () => {
      await userIdentityACL.authorize(serviceProvider.address, true);

      await expect(
        userIdentityACL
          .connect(serviceProvider)
          ['isAllowedToExecuteCallFor(address)'](user.address)
      ).to.eventually.true;
    });

    it('should forbid the caller for querying user identity', async () => {
      await userIdentityACL.authorize(serviceProvider.address, false);

      await expect(
        userIdentityACL['isAllowedToExecuteCallFor(address)'](user.address)
      ).to.eventually.false;
    });
  });
});
