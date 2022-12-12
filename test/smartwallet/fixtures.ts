import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre, { ethers } from 'hardhat';
import { ISmartWalletFactory, SmartWallet } from 'typechain-types';
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
  let externalWallet;
  let privateKey;
  if (hre.network.config.chainId === 31) {
    externalWallet = signer;
    privateKey = process.env.PRIVATE_KEY || '';
  } else {
    externalWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    privateKey = externalWallet.privateKey;

    await signer.sendTransaction({
      to: externalWallet.address,
      value: ethers.utils.parseEther('1'),
    });
  }
  let smartWallet;

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
