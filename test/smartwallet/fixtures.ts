import { ethers } from 'hardhat';
import { ISmartWalletFactory } from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';

export const smartwalletFactoryFixture = async () => {
  const { contract: smartwalletFactory, signers } =
    await deployContract<ISmartWalletFactory>(
      'SmartWalletFactory',
      {},
      (await ethers.getContractFactory(
        'SmartWalletFactory',
        {}
      )) as Factory<ISmartWalletFactory>
    );

  return { smartwalletFactory, signers };
};
