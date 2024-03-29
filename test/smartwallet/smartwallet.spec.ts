import { expect } from 'chairc';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from 'ethereum-waffle';
import { SmartWalletFactory, SmartWallet } from 'typechain-types';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from './fixtures';
import { computeSalt, encoder, signTransactionForExecutor } from './utils';
import { ethers } from 'hardhat';
import { Wallet } from 'ethers';

describe('RIF Gateway SmartWallet', async () => {
  let smartWalletFactory: SmartWalletFactory;
  let signers: SignerWithAddress[];
  let smartwalletOwner: SignerWithAddress;

  beforeEach(async () => {
    ({ smartWalletFactory, signers } = await loadFixture(
      smartwalletFactoryFixture
    ));

    smartwalletOwner = signers[1];
  });

  describe('Smart wallet creation', async () => {
    it('should generate smart wallet address without deployment', async () => {
      const salt = computeSalt(smartwalletOwner, smartWalletFactory.address);
      const deployedWallet = await (
        await smartWalletFactory.createUserSmartWallet(smartwalletOwner.address)
      ).wait();
      const deployed = deployedWallet.events && deployedWallet.events[0].args;
      const deployedAddress = deployed && deployed['addr'];

      const computedAddrOnChain =
        await smartWalletFactory.getSmartWalletAddress(
          smartwalletOwner.address
        );

      const computedAddrOffChain = ethers.utils.getCreate2Address(
        smartWalletFactory.address,
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

  describe('Message signing and nonce verification', () => {
    let smartWallet: SmartWallet | undefined;
    let privateKey: string;
    let externalWallet: Wallet | SignerWithAddress;

    beforeEach(async () => {
      ({ smartWallet, privateKey, externalWallet } = await loadFixture(
        externalSmartwalletFixture.bind(
          null,
          smartWalletFactory,
          signers[0],
          true
        )
      ));
    });

    it('should allow to sign a message', async () => {
      const { req, sig } = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        externalWallet.address,
        smartWalletFactory
      );

      await expect(smartWallet!.verify(req, sig), 'Verification failed').not.to
        .be.rejected;
    });

    it('should revert if executor is different from the sender', async () => {
      const { req, sig } = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        ethers.constants.AddressZero, // wrong executor specified
        smartWalletFactory
      );

      await expect(
        smartWallet!.verify(req, sig),
        'Executor verification failed'
      ).to.be.rejected;
    });

    it('should revert if nonce is too high', async () => {
      const mtx = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        externalWallet.address,
        smartWalletFactory,
        undefined,
        '5'
      );

      await expect(
        smartWallet!.execute(
          mtx,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          {
            gasLimit: 3000000,
          }
        ),
        'Nonce verification failed'
      )
        .to.revertedWith('InvalidNonce')
        .withArgs(5);
    });

    it('should revert if nonce used twice', async () => {
      const mtx = await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        externalWallet.address,
        smartWalletFactory
      );

      await expect(
        smartWallet!.execute(
          mtx,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          {
            gasLimit: 3000000,
          }
        )
      ).not.to.be.rejected;

      await expect(
        smartWallet!.execute(
          mtx,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          {
            gasLimit: 3000000,
          }
        ),
        'Executor verification failed'
      )
        .to.revertedWith('InvalidBlockForNonce')
        .withArgs(0);
    });
  });
});
