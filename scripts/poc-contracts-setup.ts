import { ethers } from 'hardhat';
import {
  ISmartWalletFactory,
  Providers,
  TropykusBorrowingService,
  ServiceTypeManager,
  TropykusLendingService,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
import { deployTropykusContracts } from 'test/utils/tropykusFixture';
const NATIVE_CURRENCY = ethers.constants.AddressZero;

async function deployServiceTypeManager() {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});
  console.log('ServiceTypeManager deployed at: ', serviceTypeManager.address);
  return serviceTypeManager;
}

async function deploySmartWalletFactory() {
  const { contract: smartWalletFactory } =
    await deployContract<ISmartWalletFactory>('SmartWalletFactory', {});
  console.log('SmartWalletFactory deployed at: ', smartWalletFactory.address);
  return smartWalletFactory;
}

async function deployAndSetupTropykusContracts() {
  const contracts = await deployTropykusContracts();
  console.log('TropykusContracts delpoyed');
  return contracts;
}

async function deployProviders(
  smartWalletFactory: ISmartWalletFactory,
  contracts: {
    comptroller: string;
    oracle: string;
    crbtc: string;
    cdoc: string;
    doc: string;
  }
) {
  // const {
  //   contract: acmeLending,
  //   signers: [owner],
  // } = await deployContract<ACME>('ACME', {});

  // Add initial liquidity of 0.001 RBTC
  // await owner.sendTransaction({
  //   to: acmeLending.address,
  //   value: ethers.utils.parseEther('0.001'),
  // });

  const { contract: tropykusLendingService } =
    await deployContract<TropykusLendingService>('TropykusLendingService', {
      crbtc: contracts.crbtc,
      smartWalletFactory: smartWalletFactory.address,
    });

  const { contract: tropykusBorrowingService } =
    await deployContract<TropykusBorrowingService>('TropykusBorrowingService', {
      smartWalletFactory: smartWalletFactory.address,
      contracts: contracts,
    });

  return {
    // acmeLending,
    tropykusLendingService,
    tropykusBorrowingService,
  };
}

async function deployProvidersContract(serviceTypeManagerAddr: string) {
  const { contract: providersContract } = await deployContract<Providers>(
    'Providers',
    {
      stm: serviceTypeManagerAddr,
    }
  );
  console.log('Providers contract deployed at: ', providersContract.address);
  return providersContract;
}

async function setupServices() {
  const smartWalletFactory = await deploySmartWalletFactory();
  const tropykusContracts = await deployAndSetupTropykusContracts();
  const serviceTypeManager = await deployServiceTypeManager();

  // allow lending service interface id
  const LENDING_SERVICE_INTERFACEID = '0x5f5a2f99';
  const tLx = await serviceTypeManager.addServiceType(
    LENDING_SERVICE_INTERFACEID
  );
  tLx.wait();

  // allow borrowing service interface id
  const BORROW_SERVICE_INTERFACEID = '0x710b6510';
  const tBx = await serviceTypeManager.addServiceType(
    BORROW_SERVICE_INTERFACEID
  );
  tBx.wait();

  //deploy providers contracts

  // add providers
  // deploy service provider contracts
  const { tropykusLendingService, tropykusBorrowingService } =
    await deployProviders(smartWalletFactory, tropykusContracts);

  const providersContract = await deployProvidersContract(
    serviceTypeManager.address
  );

  console.log(
    'tropykusLendingService deployed at: ',
    tropykusLendingService.address
  );
  console.log(
    'tropykusLendingService deployed at: ',
    tropykusBorrowingService.address
  );

  const addTropykusServiceTx = await providersContract.addService(
    tropykusLendingService.address
  );
  await addTropykusServiceTx.wait();

  console.log('TropykusLendingService was added successfuly');

  const addTropykusBorrowingServiceTx = await providersContract.addService(
    tropykusBorrowingService.address
  );
  await addTropykusBorrowingServiceTx.wait();

  console.log('TropykusBorrowingService was added successfuly');

  const contractsJSON = {
    providersContract: providersContract.address,
    smartWalletFactory: smartWalletFactory.address,
    tropykusLendingService: tropykusLendingService.address,
    tropykusBorrowingService: tropykusBorrowingService.address,
    tropykusDOC: tropykusContracts.doc,
    tropykusCDOC: tropykusContracts.cdoc,
    tropykusComptroller: tropykusContracts.comptroller,
    tropykusCRBTC: tropykusContracts.crbtc,
    tropykusOracle: tropykusContracts.oracle,
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
      loanToValueCurrency: NATIVE_CURRENCY,
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
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: tropykusContracts.doc,
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
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: tropykusContracts.doc,
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
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: tropykusContracts.doc,
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
      loanToValueCurrency: NATIVE_CURRENCY,
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
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
}

setupServices().then(() => console.log('done 👀'));
