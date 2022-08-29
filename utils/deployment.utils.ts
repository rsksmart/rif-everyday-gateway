import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import { Libraries } from 'hardhat/types';
import {} from 'typechain-types';

export interface Factory<C extends Contract> extends ContractFactory {
  deploy: (...args: Array<unknown>) => Promise<C>;
}

export const deployContract = async <
  C extends Contract,
  A = Factory<C>['deploy']
>(
  contractName: string,
  constructorArgs: A,
  factory?: Factory<C>
): Promise<{
  contract: C;
  signers: SignerWithAddress[];
  contractFactory: Factory<C>;
}> => {
  const options = Object.values(constructorArgs);
  const contractFactory =
    factory ?? ((await ethers.getContractFactory(contractName)) as Factory<C>);

  return {
    contract: await contractFactory.deploy(...options),
    signers: await ethers.getSigners(),
    contractFactory,
  };
};

export const onlyDeployContract = async <C extends Contract>(
  contractName: string,
  constructorArgs?: any,
  libraries?: Libraries | undefined
): Promise<C> => {
  const options = constructorArgs
    ? Object.values(constructorArgs)
    : new Array();
  const contractFactory = (await ethers.getContractFactory(contractName, {
    libraries,
  })) as Factory<C>;

  const contract = await contractFactory.deploy(...options);

  return contract;
};
