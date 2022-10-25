import { expect } from 'chairc';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from 'ethereum-waffle';
import {
  SmartWalletFactory,
  ForwardRequestStruct,
  SmartWallet,
} from 'typechain-types';
import { smartwalletFactoryFixture } from './fixtures';
import {
  computeSalt,
  encoder,
  getLocalEip712Signature,
  TypedRequestData,
} from 'test/utils/mock.utils';
import { ethers } from 'hardhat';
import { SignTypedDataVersion, TypedDataUtils } from '@metamask/eth-sig-util';
import { Wallet } from 'ethers';
const ONE_FIELD_IN_BYTES = 32;
const HARDHAT_CHAIN_ID = 31337;

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
      // await (
      //   await smartwalletFactory.createUserSmartWallet(smartwalletOwner.address)
      // ).wait();
      smartWalletAddress = await smartwalletFactory.getSmartWalletAddress(
        smartwalletOwner.address
      );
      console.log('smartWalletAddress', smartWalletAddress);
      smartWallet = await ethers.getContractAt(
        'SmartWallet',
        smartWalletAddress,
        smartwalletOwner
      );
      // console.log('smartWallet', smartWallet);
      externalWallet = ethers.Wallet.createRandom();
      console.log('externalWallet', externalWallet);
      privateKey = Buffer.from(
        externalWallet.privateKey.substring(2, 66),
        'hex'
      );
      console.log('privateKey', privateKey);
    });

    function getSuffixData(typedRequestData: TypedRequestData): string {
      const encoded = TypedDataUtils.encodeData(
        typedRequestData.primaryType,
        typedRequestData.message,
        typedRequestData.types,
        SignTypedDataVersion.V4
      );

      const messageSize = Object.keys(typedRequestData.message).length;

      return (
        '0x' + encoded.slice(messageSize * ONE_FIELD_IN_BYTES).toString('hex')
      );
    }

    it('should allowed to sign a message', async () => {
      const forwardRequest: ForwardRequestStruct = {
        from: ethers.constants.AddressZero, // smartwalletOwner.address,
        nonce: '0',
        executor: ethers.constants.AddressZero, // smartWalletAddress,
      };
      console.log('forwardRequest', forwardRequest);

      const typedRequestData = new TypedRequestData(
        HARDHAT_CHAIN_ID,
        smartWallet.address,
        forwardRequest
      );
      console.log('typedRequestData', typedRequestData);

      const suffixData = getSuffixData(typedRequestData);
      console.log('suffixData', suffixData);

      const signature = getLocalEip712Signature(typedRequestData, privateKey);
      console.log('signature', signature);

      await expect(
        smartWallet.verify(suffixData, forwardRequest, signature),
        'Verification failed'
      ).not.to.be.rejected;
    });
  });
});
