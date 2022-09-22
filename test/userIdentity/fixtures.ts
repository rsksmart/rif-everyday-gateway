import { ethers } from 'hardhat';
import {
  ACME,
  UserIdentity,
  IUserIdentityFactory,
  IUserIdentityACL,
  UserIdentityFactory,
} from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';
import ACMEScheme from 'artifacts/contracts/mocks/ACME.sol/ACME.json';
import UserIdentityACLScheme from 'artifacts/contracts/userIdentity/IUserIdentityACL.sol/IUserIdentityACL.json';
import { deployMockContract } from 'test/utils/mock.utils';

export const userIdentityFactoryFixture = async () => {
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

export const userIdentityFixture = async () => {
  const signers = await ethers.getSigners();
  const signer = signers[0];
  const user = signers[10];

  const userIdentityACLMock = await deployMockContract<IUserIdentityACL>(
    signer,
    UserIdentityACLScheme.abi
  );

  const userAddr = user.address;
  const { contract: userIdentity } = await deployContract<UserIdentity>(
    'UserIdentity',
    {
      userAddr,
      userIdentityACLMock: userIdentityACLMock.address,
    },
    (await ethers.getContractFactory(
      'UserIdentity',
      {}
    )) as Factory<UserIdentity>
  );
  const mockTargetContract = await deployMockContract<ACME>(
    signer,
    ACMEScheme.abi
  );

  return {
    userIdentity,
    userIdentityACLMock,
    mockTargetContract,
    user,
    signers,
  };
};

export const userIdentityACLFixture = async () => {
  const { contract: userIdentityACL, signers } =
    await deployContract<IUserIdentityACL>(
      'UserIdentityACL',
      {},
      (await ethers.getContractFactory(
        'UserIdentityACL',
        {}
      )) as Factory<IUserIdentityACL>
    );

  return { userIdentityACL, signers };
};
