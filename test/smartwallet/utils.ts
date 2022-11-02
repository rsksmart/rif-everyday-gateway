import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { isAddress, ParamType } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  MessageTypeProperty,
  MessageTypes,
  signTypedData,
  SignTypedDataVersion,
  TypedMessage,
  TypedDataUtils,
} from '@metamask/eth-sig-util';
import { IForwarder, ISmartWalletFactory } from 'typechain-types';

export const ONE_FIELD_IN_BYTES = 32;
export const HARDHAT_CHAIN_ID = 31337;

export const computeSalt = (
  owner: SignerWithAddress,
  factoryAddress: string
): string => {
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['address', 'address', 'string'],
      [owner.address, factoryAddress, '0']
    )
  );
};

export const encoder = (
  types: readonly (string | ParamType)[],
  values: readonly (string | ParamType)[]
) => {
  const encodedParams = ethers.utils.defaultAbiCoder.encode(types, values);
  return encodedParams.slice(2);
};

interface Types extends MessageTypes {
  EIP712Domain: MessageTypeProperty[];
  ForwardRequest: MessageTypeProperty[];
}

type Domain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
};

export const domainSeparatorType = {
  prefix: 'string name,string version',
  name: 'RSK RIF GATEWAY',
  version: '1',
};

export const eIP712DomainType: MessageTypeProperty[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

export const forwardRequestType: MessageTypeProperty[] = [
  { name: 'from', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'executor', type: 'address' },
];

export const getDomainSeparator = (
  verifyingContract: string,
  chainId: number
): Domain => {
  return {
    name: domainSeparatorType.name,
    version: domainSeparatorType.version,
    chainId: chainId,
    verifyingContract: verifyingContract,
  };
};

export function getLocalEip712Signature(
  typedRequestData: TypedMessage<Types>,
  privateKey: Buffer
): string {
  return signTypedData({
    privateKey: privateKey,
    data: typedRequestData,
    version: SignTypedDataVersion.V4,
  });
}

export class TypedRequestData implements TypedMessage<Types> {
  readonly types: Types;

  readonly domain: Domain;

  readonly primaryType: string;

  readonly message: Record<string, unknown>;

  constructor(
    chainId: number,
    verifier: string,
    forwardRequest: IForwarder.ForwardRequestStruct
  ) {
    this.types = {
      EIP712Domain: eIP712DomainType,
      ForwardRequest: forwardRequestType,
    };
    this.domain = getDomainSeparator(verifier, chainId);
    this.primaryType = 'ForwardRequest';
    // in the signature, all "request" fields are flattened out at the top structure.
    // other params are inside "relayData" sub-type
    this.message = {
      ...forwardRequest,
    };
  }
}

export const getSuffixData = (typedRequestData: TypedRequestData): string => {
  const encoded = TypedDataUtils.encodeData(
    typedRequestData.primaryType,
    typedRequestData.message,
    typedRequestData.types,
    SignTypedDataVersion.V4
  );

  const messageSize = Object.keys(typedRequestData.message).length;

  return '0x' + encoded.slice(messageSize * ONE_FIELD_IN_BYTES).toString('hex');
};

export const signTransactionForExecutor = async (
  from: string,
  privateKey: string,
  executor: string,
  smartwalletFactory: ISmartWalletFactory,
  chainId: number = HARDHAT_CHAIN_ID,
  nonce?: string
): Promise<{
  forwardRequest: IForwarder.ForwardRequestStruct;
  signature: string;
  suffixData: string;
}> => {
  const smartWalletAddress = await smartwalletFactory.getSmartWalletAddress(
    from
  );

  if (!nonce) {
    const onChainNonce = await (
      await ethers.getContractAt('SmartWallet', smartWalletAddress)
    ).nonce();
    nonce = onChainNonce.toString();
  }

  const forwardRequest: IForwarder.ForwardRequestStruct = {
    from: from,
    nonce: nonce!,
    executor: executor,
  };

  const typedRequestData = new TypedRequestData(
    chainId,
    smartWalletAddress,
    forwardRequest
  );

  const privateKeyBuf = Buffer.from(privateKey.substring(2, 66), 'hex');

  const suffixData = getSuffixData(typedRequestData);

  const signature = getLocalEip712Signature(typedRequestData, privateKeyBuf);

  return { forwardRequest, signature, suffixData };
};
