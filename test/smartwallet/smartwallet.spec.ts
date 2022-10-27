import { expect } from 'chairc';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from 'ethereum-waffle';
import { SmartWalletFactory, IForwarder, SmartWallet } from 'typechain-types';
import { smartwalletFactoryFixture } from './fixtures';
import {
  computeSalt,
  encoder,
  getLocalEip712Signature,
  getSuffixData,
  HARDHAT_CHAIN_ID,
  signTransactionForExecutor,
  TypedRequestData,
} from './utils';
import { ethers } from 'hardhat';
import { Wallet } from 'ethers';

describe('RIF Gateway SmartWallet', () => {
  let smartwalletFactory: SmartWalletFactory;
  let signers: SignerWithAddress[];
  let smartwalletOwner: SignerWithAddress;

  beforeEach(async () => {
    ({ smartwalletFactory, signers } = await loadFixture(
      smartwalletFactoryFixture
    ));

    smartwalletOwner = signers[1];
  });

  describe('Smart wallet creation', () => {
    it('should generate smart wallet address without deployment', async () => {
      const salt = computeSalt(smartwalletOwner, smartwalletFactory.address);
      const deployedWallet = await (
        await smartwalletFactory.createUserSmartWallet(smartwalletOwner.address)
      ).wait();
      const deployed = deployedWallet.events && deployedWallet.events[0].args;
      const deployedAddress = deployed && deployed['addr'];

      const computedAddrOnChain =
        await smartwalletFactory.getSmartWalletAddress(
          smartwalletOwner.address
        );

      const computedAddrOffChain = ethers.utils.getCreate2Address(
        smartwalletFactory.address,
        salt,
        ethers.utils.keccak256(
          (await ethers.getContractFactory('SmartWallet')).bytecode +
            encoder(['address'], [smartwalletOwner.address])
        )
      );

      expect(deployedAddress).to.be.equals(computedAddrOffChain);
      expect(deployedAddress).to.be.equals(computedAddrOnChain);
    });
  });

  describe('Message signing', () => {
    let smartWalletAddress: string;
    let smartWallet: SmartWallet;
    let privateKey: string;
    let externalWallet: Wallet;

    beforeEach(async () => {
      externalWallet = ethers.Wallet.createRandom().connect(ethers.provider);
      privateKey = externalWallet.privateKey;

      await (
        await smartwalletFactory.createUserSmartWallet(externalWallet.address)
      ).wait();

      smartWalletAddress = await smartwalletFactory.getSmartWalletAddress(
        externalWallet.address
      );
      smartWallet = await ethers.getContractAt(
        'SmartWallet',
        smartWalletAddress,
        externalWallet
      );
    });

    it('should allow to sign a message', async () => {
      const { forwardRequest, suffixData, signature } =
        await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          externalWallet.address,
          smartwalletFactory
        );

      await expect(
        smartWallet.verify(suffixData, forwardRequest, signature),
        'Verification failed'
      ).not.to.be.rejected;
    });

    it('should revert if executor is different from the sender', async () => {
      const { forwardRequest, suffixData, signature } =
        await signTransactionForExecutor(
          externalWallet.address,
          privateKey,
          ethers.constants.AddressZero,
          smartwalletFactory
        );

      await expect(
        smartWallet.verify(suffixData, forwardRequest, signature),
        'Executor verification failed'
      ).to.be.rejected;
    });
  });
});
