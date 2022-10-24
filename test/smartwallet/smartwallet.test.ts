import { expect } from 'chairc';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from 'ethereum-waffle';
import { SmartWalletFactory } from 'typechain-types';
import { smartwalletFactoryFixture } from './fixtures';
import { computeSalt, encoder } from 'test/utils/mock.utils';
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
});
