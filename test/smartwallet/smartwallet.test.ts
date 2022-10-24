import { expect } from 'chairc';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from 'ethereum-waffle';
import { SmartWalletFactory } from 'typechain-types';
import { smartwalletFactoryFixture } from './fixtures';
import { computeCREATE2Addr, computeSalt } from 'test/utils/mock.utils';
import { ethers } from 'hardhat';

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
      const smartWalletAddr = await smartwalletFactory.getSmartWalletAddress(
        smartwalletOwner.address
      );

      const preComputedAddress = computeCREATE2Addr(
        smartwalletFactory.address,
        computeSalt(smartwalletOwner, smartwalletFactory.address),
        (await ethers.getContractFactory('SmartWalletFactory')).bytecode
      );

      const deployedWallet = await (
        await smartwalletFactory.createUserSmartWallet(smartwalletOwner.address)
      ).wait();

      console.log(deployedWallet.events);

      console.log(preComputedAddress);
      console.log(smartWalletAddr);
    });
  });
});
