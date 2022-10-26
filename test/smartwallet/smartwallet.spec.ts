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
  TypedRequestData,
} from './utils';
import { ethers } from 'hardhat';
import { Wallet } from 'ethers';

import {
  recoverTypedSignature,
  SignTypedDataVersion,
} from '@metamask/eth-sig-util';

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
    let privateKey: Buffer;
    let externalWallet: Wallet;

    beforeEach(async () => {
      externalWallet = ethers.Wallet.createRandom();
      privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );

      await (
        await smartwalletFactory.createUserSmartWallet(externalWallet.address)
      ).wait();

      smartWalletAddress = await smartwalletFactory.getSmartWalletAddress(
        externalWallet.address
      );
      console.log('smartWalletAddress', smartWalletAddress);
      smartWallet = await ethers.getContractAt(
        'SmartWallet',
        smartWalletAddress,
        externalWallet
      );
    });

    it.only('should allowed to sign a message', async () => {
      const forwardRequest: IForwarder.ForwardRequestStruct = {
        from: externalWallet.address, // ethers.constants.AddressZero
        nonce: '0',
        executor: smartWalletAddress, //ethers.constants.AddressZero,
      };

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        forwardRequest
      );
      // console.log(typedRequestData);

      const suffixData = getSuffixData(typedRequestData);
      // console.log('suffixData', suffixData);

      const signature = getLocalEip712Signature(typedRequestData, privateKey);
      // console.log('signature', signature);

      // await expect(
      //   smartWallet.verify(suffixData, forwardRequest, signature),
      //   'Verification failed'
      // ).not.to.be.rejected;

      console.log(externalWallet.address);
      console.log(
        await smartWallet.recov(suffixData, forwardRequest, signature)
      );

      const recovered = recoverTypedSignature({
        data: typedRequestData,
        signature: signature,
        version: SignTypedDataVersion.V4,
      });

      console.log(recovered);

      // const domain = getDomainSeparator(smartWallet.address, HARDHAT_CHAIN_ID);
      // const onChainDomain = await smartWallet.getDomainSeparator();

      // console.log(domain);
      // console.log(domain);
    });
  });
});
