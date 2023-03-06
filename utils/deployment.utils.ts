import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import { IRIFGateway, RIFGateway, UUPSUpgradeable } from 'typechain-types';

export interface Factory<C extends Contract> extends ContractFactory {
  deploy: (...args: Array<unknown>) => Promise<C>;
}

export const deployContract = async <C extends Contract, A = {}>(
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

  const contract = await contractFactory.deploy(...options);
  await contract.deployed();

  return {
    contract: contract,
    signers: await ethers.getSigners(),
    contractFactory,
  };
};

// Deploys a UUPS compliant proxy contract with its logic.
export const deployProxyContract = async <
  L extends Contract,
  I extends Contract
>(
  contractName: string,
  logicContractName: string,
  initializeData: string,
  signer: SignerWithAddress | null = null
): Promise<{
  contract: I;
  signers: SignerWithAddress[];
}> => {
  const owner = signer ?? (await ethers.getSigners())[0];
  // Deploy contracts logic
  const logicContractFactory = (await ethers.getContractFactory(
    logicContractName
  )) as Factory<L>;

  const logicContract = await logicContractFactory.deploy();
  await logicContract.deployed();

  // Deploy main upgradeable contract
  const mainContractFactory = (await ethers.getContractFactory(
    contractName
  )) as Factory<RIFGateway>;

  const mainProxyContract = await mainContractFactory.deploy(
    logicContract.address,
    initializeData,
    {
      gasLimit: 3000000,
    }
  );
  await mainProxyContract.deployed();

  const contractAsInterface = (await ethers.getContractAt(
    logicContractName,
    mainProxyContract.address,
    mainProxyContract.signer
  )) as I;

  return {
    contract: contractAsInterface,
    signers: await ethers.getSigners(),
  };
};
