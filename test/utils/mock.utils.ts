import { JsonFragment } from '@ethersproject/abi';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { randomBytes } from 'crypto';
import {
  deployMockContract as deployWaffleContract,
  MockContract as WaffleMockContract,
  Stub,
} from 'ethereum-waffle';
import {
  BaseContract,
  BigNumber,
  BigNumberish,
  ContractFunction,
  Signer,
  Wallet,
} from 'ethers';
import { Fragment } from 'ethers/lib/utils';
import { ethers, network, waffle } from 'hardhat';
import NetworkHelpers from '@nomicfoundation/hardhat-network-helpers';

export const oneRBTC = BigNumber.from(10).pow(18);
// mock contract default balance set to a very
// high value to not run out of funds during testing
export const defaultBalance = '0x84595161401484A000000';

export const calculatePercentageWPrecision = (
  num: BigNumberish,
  perc: BigNumberish,
  precision = oneRBTC
): BigNumber => {
  return BigNumber.from(num).mul(perc).div(precision.mul(100));
};

export const getRandomBytes = (size = 32, encoding: BufferEncoding = 'hex') => {
  return randomBytes(size).toString(encoding);
};

export const generateRandomWallet = (): Signer => {
  const id = getRandomBytes();
  const privateKey = '0x' + id;
  const wallet = new Wallet(privateKey);

  return wallet;
};

export const getFunctionSelector = (signature: string) =>
  ethers.utils.id(signature).substring(0, 10);

export const timeNowInSeconds = () => Math.round(Date.now() / 1000);

export const sendrBtcToContract = async (
  contractAddress: string,
  amount: BigNumberish
) => {
  const provider = waffle.provider;
  const [wallet] = provider.getWallets();
  await wallet.sendTransaction({ to: contractAddress, value: amount });
};

// Impersonates a contract
// NOTE: This will only work in Hardhat network
export const contractAsSigner = async (
  contractAddress: string
): Promise<SignerWithAddress> => {
  await Promise.all([
    NetworkHelpers.impersonateAccount(contractAddress),
    setBalance(contractAddress, defaultBalance),
  ]);

  return ethers.getSigner(contractAddress);
};

export const setBalance = async (address: string, hexAmount: string) =>
  network.provider.send('hardhat_setBalance', [address, hexAmount]);

export type Contract<C> = BaseContract & {
  readonly [key in keyof C]: ContractFunction | any;
};

export type MockContract<C extends Contract<C>> = WaffleMockContract & {
  mock: {
    [key in keyof C]: Stub;
  };
  call: <T extends Contract<T>>(
    contract: T,
    functionName: keyof C,
    ...params: any[]
  ) => Promise<any>;
  staticcall: <T extends Contract<T>>(
    contract: T,
    functionName: keyof C,
    ...params: any[]
  ) => Promise<any>;
};

export const deployMockContract = async <C extends Contract<C>>(
  signer: Signer,
  abi: string | Array<Fragment | JsonFragment | string>
): Promise<MockContract<C>> => {
  return (await deployWaffleContract(signer, abi as any)) as MockContract<C>;
};
