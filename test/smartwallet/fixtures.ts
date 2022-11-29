import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  IFeeManager,
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
  signer: SignerWithAddress,
  deploySmartWallet: boolean = false
) => {
  const externalWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const privateKey = externalWallet.privateKey;
  let smartWallet;

  await signer.sendTransaction({
    to: externalWallet.address,
    value: ethers.utils.parseEther('1'),
  });

  if (deploySmartWallet) {
    await (
      await smartWalletFactory.createUserSmartWallet(externalWallet.address)
    ).wait();
    const smartWalletAddress = await smartWalletFactory.getSmartWalletAddress(
      externalWallet.address
    );
    smartWallet = (await ethers.getContractAt(
      'SmartWallet',
      smartWalletAddress,
      externalWallet
    )) as SmartWallet;
  }

  return {
    externalWallet,
    privateKey,
    smartWallet,
  };
};
