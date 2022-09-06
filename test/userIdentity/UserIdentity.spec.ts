import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import { IUserIdentityACL, IUserIdentityFactory } from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('User Identity', () => {
  const initialFixture = async () => {
    const { contract: identityFactory, signers } =
      await deployContract<IUserIdentityFactory>(
        'UserIdentityFactory',
        {},
        (await ethers.getContractFactory(
          'UserIdentityFactory',
          {}
        )) as Factory<IUserIdentityFactory>
      );

    return { identityFactory, signers };
  };

  it('should allow owner to add address as valid identity caller', async () => {
    const { identityFactory, signers } = await loadFixture(initialFixture);
    const [owner, provider, account1, fake_contract] = signers;

    expect(
      identityFactory.allowLendingProvider(
        account1.address,
        provider.address,
        fake_contract.address
      )
    ).to.be.fulfilled;
  });

  describe('Callers and callees', async () => {
    let identityFactory: IUserIdentityFactory,
      signers: SignerWithAddress[],
      owner: SignerWithAddress,
      provider: SignerWithAddress,
      account1: SignerWithAddress;

    beforeEach(async () => {
      ({ identityFactory, signers } = await loadFixture(initialFixture));

      owner = signers[0];
      provider = signers[1];
      account1 = signers[2];

      expect(
        identityFactory.allowLendingProvider(
          owner.address, // user
          provider.address, // caller
          account1.address // callee
        )
      ).to.be.fulfilled;
    });

    it('should allow caller create new user identity for owner', async () => {
      const identityFactoryAsProvider = identityFactory.connect(provider);
      expect(identityFactoryAsProvider.getIdentity(owner.address)).to.be
        .fulfilled;
      expect(
        await identityFactoryAsProvider.getIdentity(owner.address)
      ).to.not.be.equal(ethers.constants.AddressZero);
    });
  });
});
