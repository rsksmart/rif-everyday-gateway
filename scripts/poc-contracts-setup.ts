import hre, { ethers } from 'hardhat';
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
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
const NATIVE_CURRENCY = ethers.constants.AddressZero;

async function deployServiceTypeManager() {
  if (hre.network.config.chainId === 31) {
    const owner = (await ethers.getSigners())[0];
    const serviceTypeManager = await ethers.getContractAt(
      'ServiceTypeManager',
      '0x98C79984c16aEe51D8c56956C5AFa2127352285f',
      owner
    );
    return serviceTypeManager;
  } else {
    const { contract: serviceTypeManager } =
      await deployContract<ServiceTypeManager>('ServiceTypeManager', {});
    console.log('ServiceTypeManager deployed at: ', serviceTypeManager.address);
    return serviceTypeManager;
  }
}

async function deploySmartWalletFactory() {
  if (hre.network.config.chainId === 31) {
    const owner = (await ethers.getSigners())[0];
    const smartWalletFactory = await ethers.getContractAt(
      'SmartWalletFactory',
      '0x677dae6b27F90F6fb4703fDb1D20e873881Fe81A',
      owner
    );
    return smartWalletFactory;
  } else {
    const { contract: smartWalletFactory } =
      await deployContract<ISmartWalletFactory>('SmartWalletFactory', {});
    console.log('SmartWalletFactory deployed at: ', smartWalletFactory.address);
    return smartWalletFactory;
  }
}

async function deployAndSetupTropykusContracts() {
  if (hre.network.config.chainId === 31) {
    return {
      comptroller: '0xb1bec5376929b4e0235f1353819dba92c4b0c6bb',
      oracle: '0x9fbB872D3B45f95b4E3126BC767553D3Fa1e31C0',
      crbtc: '0x5b35072cd6110606c8421e013304110fa04a32a3',
      cdoc: '0x71e6b108d823c2786f8ef63a3e0589576b4f3914',
      doc: '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0',
    };
  } else {
    const contracts = await deployTropykusContracts();
    console.log('TropykusContracts delpoyed');
    return contracts;
  }
}

async function deployProviders(
  rifGateway: IRIFGateway,
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
      gateway: rifGateway.address,
      crbtc: contracts.crbtc,
      smartWalletFactory: smartWalletFactory.address,
    });

  const { contract: tropykusBorrowingService } =
    await deployContract<TropykusBorrowingService>('TropykusBorrowingService', {
      gateway: rifGateway.address,
      smartWalletFactory: smartWalletFactory.address,
      contracts: contracts,
    });

  return {
    tropykusLendingService,
    tropykusBorrowingService,
  };
}

async function deployRIFGatewayContract(
  serviceTypeManagerAddr: string,
  feeManagerAddr: string
) {
  const { contract: RIFGateway } = await deployContract<IRIFGateway>(
    'RIFGateway',
    {
      stm: serviceTypeManagerAddr,
      feeManager: feeManagerAddr,
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
  const smartWalletFactory = await deploySmartWalletFactory();
  const tropykusContracts = await deployAndSetupTropykusContracts();
  const serviceTypeManager = await deployServiceTypeManager();

  // allow lending service interface id
  const tLx = await serviceTypeManager.addServiceType(
    LENDING_SERVICE_INTERFACEID
  );
  await tLx.wait();

  // allow borrowing service interface id
  const tBx = await serviceTypeManager.addServiceType(
    BORROW_SERVICE_INTERFACEID
  );
  await tBx.wait();

  const RIFGatewayContract = await deployRIFGatewayContract(
    serviceTypeManager.address,
    feeManagerContract.address
  );

  const { tropykusLendingService, tropykusBorrowingService } =
    await deployProviders(
      RIFGatewayContract,
      smartWalletFactory,
      tropykusContracts
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
    FeeManager: feeManagerContract.address,
    smartWalletFactory: smartWalletFactory.address,
    ServiceTypeManager: serviceTypeManager.address,
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
      owner: ethers.constants.AddressZero,
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
      owner: ethers.constants.AddressZero,
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
      owner: ethers.constants.AddressZero,
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
      owner: ethers.constants.AddressZero,
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
      owner: ethers.constants.AddressZero,
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
      owner: ethers.constants.AddressZero,
    })
  ).wait();
}

setupServices().then(() => console.log('done 👀'));
