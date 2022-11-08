import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  ISmartWalletFactory,
  SmartWallet,
  SmartWalletFactory,
} from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';

export const smartwalletFactoryFixture = async () => {
  const { contract: smartWalletFactory, signers } =
    await deployContract<ISmartWalletFactory>(
      'SmartWalletFactory',
      {},
      (await ethers.getContractFactory(
        'SmartWalletFactory',
        {}
      )) as Factory<ISmartWalletFactory>
    );

  return { smartWalletFactory, signers };
};

export const externalSmartwalletFixture = async (
  smartWalletFactory: ISmartWalletFactory,
  signers: SignerWithAddress[],
  testnet: boolean,
  privateKeys: string[]
) => {
  let externalWallet;
  let privateKey;
  if (testnet) {
    externalWallet = signers[1];
    privateKey = privateKeys[1];
  } else {
    externalWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    privateKey = externalWallet.privateKey;

    await signers[0].sendTransaction({
      to: externalWallet.address,
      value: ethers.utils.parseEther('1'),
    });
  }
  await (
    await smartWalletFactory.createUserSmartWallet(externalWallet.address)
  ).wait();

  const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
    externalWallet.address
  );
  const smartWallet = (await ethers.getContractAt(
    'SmartWallet',
    smartWalletAddress,
    externalWallet
  )) as SmartWallet;

  return {
    externalWallet,
    privateKey,
    smartWallet,
  };
};
