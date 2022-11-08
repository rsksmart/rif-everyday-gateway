import hre, { ethers } from 'hardhat';
import {
  ACME,
  Providers,
  TropykusBorrowingService,
  UserIdentityFactory,
  ServiceTypeManager,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
import { BytesLike } from 'ethers';
import { toUtf8Bytes } from 'ethers/lib/utils';
const NATIVE_CURRENCY = ethers.constants.AddressZero;
const tropikusDOC = '0x59b670e9fa9d0a427751af201d676719a970857b';
const tropykusContracts = {
  comptroller: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
  oracle: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
  crbtc: '0x7bc06c482dead17c0e297afbc32f6e63d3846650',
  cdoc: '0x4a679253410272dd5232b3ff7cf5dbb88f295319',
};
const tropykusContractsTestnet = {
  comptroller: '0xb1bec5376929b4e0235f1353819dba92c4b0c6bb',
  oracle: '0x9fbB872D3B45f95b4E3126BC767553D3Fa1e31C0',
  crbtc: '0x5b35072cd6110606c8421e013304110fa04a32a3',
  cdoc: '0x71e6b108d823c2786f8ef63a3e0589576b4f3914',
};
const docAddressTestnet = '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0';
const onTestnet = true; // hre.network.config.chainId === 31;
console.log('onTestnet', onTestnet);

async function deployIdentityFactory() {
  const { contract: identityFactory } =
    await deployContract<UserIdentityFactory>('UserIdentityFactory', {});
  console.log('UserIdentityFactory deployed at: ', identityFactory.address);
  return identityFactory;
}

async function deployServiceTypeManager() {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});
  console.log('ServiceTypeManager deployed at: ', serviceTypeManager.address);
  return serviceTypeManager;
}

async function deployBorrowingServices(identityFactory: UserIdentityFactory) {
  const { contract: tropykusBorrowingService } =
    await deployContract<TropykusBorrowingService>('TropykusBorrowingService', {
      identityFactory: identityFactory.address,
      tropykusContracts: onTestnet
        ? tropykusContractsTestnet
        : tropykusContracts,
    });
  return { tropykusBorrowingService };
}

async function deployLendingServices(identityFactory: UserIdentityFactory) {
  const {
    contract: acmeLending,
    signers: [owner],
  } = await deployContract<ACME>('ACME', {});

  // Add initial liquidity of 0.001 RBTC
  await owner.sendTransaction({
    to: acmeLending.address,
    value: ethers.utils.parseEther('0.001'),
  });

  const { contract: tropykusLendingService } = await deployContract(
    'TropykusLendingService',
    {
      crbtc: onTestnet
        ? tropykusContractsTestnet.crbtc
        : tropykusContracts.crbtc,
      userIdentityFactory: identityFactory.address,
    }
  );

  return {
    acmeLending,
    tropykusLendingService,
  };
}

async function deployProvidersContract(serviceTypeManager: string) {
  const { contract: providersContract } = await deployContract<Providers>(
    'Providers',
    {
      stm: serviceTypeManager,
    }
  );
  console.log('Providers contract deployed at: ', providersContract.address);
  return providersContract;
}

async function setupLending() {
  const identityFactory = await deployIdentityFactory();
  const serviceTypeManager = await deployServiceTypeManager();

  // lending service interface id
  // const LENDING_SERVICE_INTERFACEID = '0xce663897';
  const LENDING_SERVICE_INTERFACEID = '0xab102a6a';
  const tLx = await serviceTypeManager.addServiceType(
    LENDING_SERVICE_INTERFACEID
  );
  tLx.wait();

  // borrow serivce interface id = 0xe3864a23
  // const BORROW_SERVICE_INTERFACEID = '0xe3864a23';
  const BORROW_SERVICE_INTERFACEID = '0x768dc69d';

  const tBx = await serviceTypeManager.addServiceType(
    BORROW_SERVICE_INTERFACEID
  );
  tBx.wait();
  //deploy providers contracts

  // add providers
  // deploy service provider contracts
  const { acmeLending, tropykusLendingService } = await deployLendingServices(
    identityFactory
  );

  const { tropykusBorrowingService } = await deployBorrowingServices(
    identityFactory
  );

  const providersContract = await deployProvidersContract(
    serviceTypeManager.address
  );

  console.log('tropykusLendingService', tropykusLendingService.address);
  console.log('tropykusBorrowingService', tropykusBorrowingService.address);

  const addTropykusServiceTx = await providersContract.addService(
    tropykusLendingService.address
  );
  await addTropykusServiceTx.wait();

  const addTropykusBorrowingServiceTx = await providersContract.addService(
    tropykusBorrowingService.address
  );
  await addTropykusBorrowingServiceTx.wait();

  const contractsJSON = {
    acmeLending: acmeLending.address,
    providersContract: providersContract.address,
    identityFactory: identityFactory.address,
    tropykusLendingService: tropykusLendingService.address,
    tropykusBorrowingService: tropykusBorrowingService.address,
  };
  await writeFileSync('contracts.json', JSON.stringify(contractsJSON, null, 2));

  await (
    await tropykusBorrowingService.addListing({
      id: 0,
      minAmount: ethers.utils.parseEther('1'),
      maxAmount: ethers.utils.parseEther('100'),
      minDuration: 0,
      maxDuration: 1000,
      interestRate: ethers.utils.parseEther('0.01'), // 1%
      loanToValue: ethers.utils.parseEther('10000'),
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
  await (
    await tropykusBorrowingService.addListing({
      id: 1,
      minAmount: ethers.utils.parseEther('1'),
      maxAmount: ethers.utils.parseEther('100'),
      minDuration: 0,
      maxDuration: 1000,
      interestRate: ethers.utils.parseEther('0.02'), // 2%
      loanToValue: ethers.utils.parseEther('10000'),
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: onTestnet ? docAddressTestnet : tropikusDOC,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
  await (
    await tropykusBorrowingService.addListing({
      id: 2,
      minAmount: ethers.utils.parseEther('1'),
      maxAmount: ethers.utils.parseEther('100'),
      minDuration: 0,
      maxDuration: 1000,
      interestRate: ethers.utils.parseEther('0.03'), // 3%
      loanToValue: ethers.utils.parseEther('10000'),
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: onTestnet ? docAddressTestnet : tropikusDOC,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
  await (
    await tropykusBorrowingService.addListing({
      id: 3,
      minAmount: ethers.utils.parseEther('1'),
      maxAmount: ethers.utils.parseEther('100'),
      minDuration: 0,
      maxDuration: 1000,
      interestRate: ethers.utils.parseEther('0.05'), // 5%
      loanToValue: ethers.utils.parseEther('10000'),
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: onTestnet ? docAddressTestnet : tropikusDOC,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
  await (
    await tropykusLendingService.addListing({
      id: 0,
      minAmount: 0,
      maxAmount: 0,
      minDuration: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.05'), // 5%
      loanToValue: 0,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Lending Service',
    })
  ).wait();

  await (
    await tropykusBorrowingService.addListing({
      id: 4,
      minAmount: 0,
      maxAmount: 0,
      minDuration: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.1'), // 10%
      loanToValue: 0,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
}

setupLending().then(() => console.log('done 👀'));
