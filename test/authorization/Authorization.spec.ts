import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deployContract, Factory } from 'utils/deployment.utils';
import { Authorization, IAuthorization } from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ER_MSG_ONLY_ROLE } from 'test/utils/errors';

async function authorizationSetUp() {
  const { contract: authorization, signers } =
    await deployContract<IAuthorization>(
      'Authorization',
      {},
      (await ethers.getContractFactory(
        'Authorization',
        {}
      )) as Factory<IAuthorization>
    );

  return { authorization, signers };
}

describe('Authorization', async () => {
  let authorization: IAuthorization;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    ({ authorization, signers } = await loadFixture(authorizationSetUp));
  });

  describe('addOwner', async () => {
    it('should add a new owner', async () => {
      const [, newOwner] = signers;
      const newOwnerAddr = newOwner.address;

      await authorization.addOwner(newOwnerAddr);

      await expect(authorization.isOwner(newOwnerAddr)).to.eventually.true;
    });

    it('should revert when the caller does not have the admin role', async () => {
      const [, nonAdminRoleCaller, newOwner] = signers;
      const authorizationAsNonAuthorized =
        authorization.connect(nonAdminRoleCaller);

      await expect(
        authorizationAsNonAuthorized.addOwner(newOwner.address)
      ).to.have.rejectedWith(ER_MSG_ONLY_ROLE);
    });
  });

  describe('addServiceProvider', async () => {
    it('should add a new service provider', async () => {
      const [, newServiceProvider] = signers;
      const newServiceProvideAddr = newServiceProvider.address;

      await authorization.addServiceProvider(newServiceProvideAddr);

      await expect(authorization.isServiceProvider(newServiceProvideAddr)).to
        .eventually.true;
    });

    it('should revert when the caller does not have the admin role', async () => {
      const [, nonAdminRoleCaller, newServiceProvider] = signers;
      const authorizationAsNonAuthorized =
        authorization.connect(nonAdminRoleCaller);

      await expect(
        authorizationAsNonAuthorized.addServiceProvider(
          newServiceProvider.address
        )
      ).to.have.rejectedWith(ER_MSG_ONLY_ROLE);
    });
  });

  describe('addWalletProvider', async () => {
    it('should add a new wallet provider', async () => {
      const [, newWalletProvider] = signers;
      const newWalletProvideAddr = newWalletProvider.address;

      await authorization.addWalletProvider(newWalletProvideAddr);

      await expect(authorization.isWalletProvider(newWalletProvideAddr)).to
        .eventually.true;
    });

    it('should revert when the caller does not have the admin role', async () => {
      const [, nonAdminRoleCaller, newWalletProvider] = signers;
      const authorizationAsNonAuthorized =
        authorization.connect(nonAdminRoleCaller);

      await expect(
        authorizationAsNonAuthorized.addWalletProvider(
          newWalletProvider.address
        )
      ).to.have.rejectedWith(ER_MSG_ONLY_ROLE);
    });
  });
});
