import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { ISmartWalletFactory, SmartWalletFactory } from 'typechain-types';
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

export const externalSmartwalletFixture = async (
  smartwalletFactory: ISmartWalletFactory,
  signers: SignerWithAddress[]
) => {
  const externalWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const privateKey = externalWallet.privateKey;

  await (
    await smartwalletFactory.createUserSmartWallet(externalWallet.address)
  ).wait();

  const smartWalletAddress = await smartwalletFactory.getSmartWalletAddress(
    externalWallet.address
  );
  const smartWallet = await ethers.getContractAt(
    'SmartWallet',
    smartWalletAddress,
    externalWallet
  );

  await signers[0].sendTransaction({
    to: externalWallet.address,
    value: ethers.utils.parseEther('1.0'),
  });

  return {
    externalWallet,
    privateKey,
    smartWallet,
  };
};
