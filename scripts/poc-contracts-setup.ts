import { ethers } from 'hardhat';
import {
  ISmartWalletFactory,
  RIFGateway,
  TropykusBorrowingService,
  ServiceTypeManager,
  TropykusLendingService,
  IRIFGateway,
  IFeeManager,
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

async function deploySmartWalletFactory(feeManagerAddr: string) {
  const { contract: smartWalletFactory } =
    await deployContract<ISmartWalletFactory>('SmartWalletFactory', {
      feeManager: feeManagerAddr,
    });
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
    tropykusLendingService,
    tropykusBorrowingService,
  };
}

async function deployRIFGatewayContract(serviceTypeManagerAddr: string) {
  const { contract: RIFGateway } = await deployContract<IRIFGateway>(
    'RIFGateway',
    {
      stm: serviceTypeManagerAddr,
    }
  );
  console.log('RIFGateway contract deployed at: ', RIFGateway.address);
  return RIFGateway;
}

async function deployFeeManager() {
  const { contract: FeeManager } = await deployContract<IFeeManager>(
    'FeeManager',
    {}
  );
  console.log('FeeManager contract deployed at: ', FeeManager.address);
  return FeeManager;
}

async function setupServices() {
  const feeManagerContract = await deployFeeManager();
  const smartWalletFactory = await deploySmartWalletFactory(
    feeManagerContract.address
  );
  const tropykusContracts = await deployAndSetupTropykusContracts();
  const serviceTypeManager = await deployServiceTypeManager();

  // allow lending service interface id
  const LENDING_SERVICE_INTERFACEID = '0xd9eedeca';
  const tLx = await serviceTypeManager.addServiceType(
    LENDING_SERVICE_INTERFACEID
  );
  tLx.wait();

  // allow borrowing service interface id
  const BORROW_SERVICE_INTERFACEID = '0x7337eabd';
  const tBx = await serviceTypeManager.addServiceType(
    BORROW_SERVICE_INTERFACEID
  );
  tBx.wait();

  //deploy providers contracts

  // add providers
  // deploy service provider contracts
  const { tropykusLendingService, tropykusBorrowingService } =
    await deployProviders(smartWalletFactory, tropykusContracts);

  const RIFGatewayContract = await deployRIFGatewayContract(
    serviceTypeManager.address
  );

  console.log(
    'tropykusLendingService deployed at: ',
    tropykusLendingService.address
  );
  console.log(
    'tropykusBorrowingService deployed at: ',
    tropykusBorrowingService.address
  );

  const addTropykusServiceTx = await RIFGatewayContract.addService(
    tropykusLendingService.address
  );
  await addTropykusServiceTx.wait();

  console.log('TropykusLendingService was added successfuly');

  const addTropykusBorrowingServiceTx = await RIFGatewayContract.addService(
    tropykusBorrowingService.address
  );
  await addTropykusBorrowingServiceTx.wait();

  console.log('TropykusBorrowingService was added successfuly');

  const contractsJSON = {
    RIFGatewayContract: RIFGatewayContract.address,
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
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: tropykusContracts.doc,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
  await (
    await tropykusBorrowingService.addListing({
      id: 1,
      minAmount: ethers.utils.parseEther('0.0001'),
      maxAmount: ethers.utils.parseEther('1'),
      minDuration: 0,
      maxDuration: 1000,
      interestRate: ethers.utils.parseEther('0.00002'), // ~ 0.0002%
      loanToValueCurrency: tropykusContracts.doc,
      currency: NATIVE_CURRENCY,
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
      minAmount: ethers.utils.parseEther('0.001'),
      maxAmount: ethers.utils.parseEther('1'),
      minDuration: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.05'), // 5%
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
      minAmount: ethers.utils.parseEther('0.001'),
      maxAmount: ethers.utils.parseEther('2'),
      minDuration: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.4'), // 4%
      loanToValueCurrency: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
    })
  ).wait();
}

setupServices().then(() => console.log('done 👀'));
