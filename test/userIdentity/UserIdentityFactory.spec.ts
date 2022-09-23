import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chairc';
import { IUserIdentityFactory } from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { userIdentityFactoryFixture } from './fixtures';

describe('UserIdentityFactory', () => {
  describe('Callers and callees', async () => {
    let identityFactory: IUserIdentityFactory,
      signers: SignerWithAddress[],
      owner: SignerWithAddress,
      provider: SignerWithAddress,
      account1: SignerWithAddress;

    beforeEach(async () => {
      ({ identityFactory, signers } = await loadFixture(
        userIdentityFactoryFixture
      ));

      owner = signers[0];
      provider = signers[1];
      account1 = signers[2];

      expect(
        identityFactory.authorize(
          provider.address, // caller
          true
        )
      ).to.be.fulfilled;
    });

    it('should authorize caller to create new user identity for owner', async () => {
      const identityFactoryAsProvider = identityFactory.connect(provider);
      expect(
        await identityFactoryAsProvider.getIdentity(owner.address)
      ).to.be.equal(ethers.constants.AddressZero);
      expect(identityFactoryAsProvider.createIdentity(owner.address)).to.be
        .fulfilled;
      expect(
        await identityFactoryAsProvider.getIdentity(owner.address)
      ).to.not.be.equal(ethers.constants.AddressZero);
    });

    it('should revert for unauthorized caller to retrieve user identity for owner', async () => {
      const identityFactoryAsProvider = identityFactory.connect(account1);
      await expect(identityFactoryAsProvider.getIdentity(owner.address)).to.be
        .reverted;
    });
  });
});
