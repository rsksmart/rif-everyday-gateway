import hre, { ethers } from 'hardhat';
import {
  ISmartWalletFactory,
  RIFGateway,
  TropykusBorrowingService,
  ServiceTypeManager,
  TropykusLendingService,
  IRIFGateway,
  IFeeManager,
  IGatewayAccessControl,
  FeeManager,
} from 'typechain-types';
import { deployContract, deployProxyContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
import { deployTropykusContracts } from 'test/utils/tropykusFixture';
import {
  BORROW_SERVICE_INTERFACEID,
  LENDING_SERVICE_INTERFACEID,
} from 'test/utils/interfaceIDs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const NATIVE_CURRENCY = ethers.constants.AddressZero;

async function deployServiceTypeManager(deployer: SignerWithAddress) {
  const { contract: serviceTypeManager } =
    await deployContract<ServiceTypeManager>('ServiceTypeManager', {});
  // }
  console.log('ServiceTypeManager deployed at: ', serviceTypeManager.address);
  return serviceTypeManager;
}

async function deploySmartWalletFactory(deployer: SignerWithAddress) {
  const { contract: smartWalletFactory } =
    await deployContract<ISmartWalletFactory>(
      'SmartWalletFactory',
      {},
      null,
      deployer
    );
  console.log('SmartWalletFactory deployed at: ', smartWalletFactory.address);
  return smartWalletFactory as ISmartWalletFactory;
}

async function deployAndSetupTropykusContracts() {
  let contracts;
  if (hre.network.config.chainId === 31) {
    contracts = {
      comptroller: '0xb1bec5376929b4e0235f1353819dba92c4b0c6bb',
      oracle: '0x9fbB872D3B45f95b4E3126BC767553D3Fa1e31C0',
      crbtc: '0x5b35072cd6110606c8421e013304110fa04a32a3',
      cdoc: '0x71e6b108d823c2786f8ef63a3e0589576b4f3914',
      doc: '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0',
    };
  } else {
    contracts = await deployTropykusContracts();
  }
  console.log(
    `TropykusContracts${hre.network.config.chainId != 31 ? +'deployed' : +''}`,
    contracts
  );
  return contracts;
}

async function deployRIFGatewayContract(
  serviceTypeManagerAddr: string,
  feeManagerAddr: string,
  accessControlAddr: string,
  deployer: SignerWithAddress
) {
  const RIFGatewayIface = new ethers.utils.Interface([
    'function initialize(address serviceTypeManagerAddr,address gatewayAccessControlAddr, address feeManagerAddr)',
  ]);

  const RIFGatewayInitMsgData = RIFGatewayIface.encodeFunctionData(
    'initialize',
    [serviceTypeManagerAddr, feeManagerAddr, accessControlAddr]
  );

  const { contract: rifGateway } = await deployProxyContract(
    'RIFGateway',
    'RIFGatewayLogicV1',
    RIFGatewayInitMsgData,
    deployer
  );
  console.log('RIFGateway contract deployed at: ', rifGateway.address);
  return rifGateway as IRIFGateway;
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
      smartWalletFactory: smartWalletFactory.address,
      contracts,
    });

  const { contract: tropykusBorrowingService } =
    await deployContract<TropykusBorrowingService>('TropykusBorrowingService', {
      gateway: rifGateway.address,
      smartWalletFactory: smartWalletFactory.address,
      contracts,
    });

  return {
    tropykusLendingService,
    tropykusBorrowingService,
  };
}

async function deployFeeManager(deployer: SignerWithAddress) {
  const feeManagerIface = new ethers.utils.Interface(['function initialize()']);
  const feeManagerMsgData = feeManagerIface.encodeFunctionData(
    'initialize',
    []
  );
  const { contract: feeManager } = await deployProxyContract<
    FeeManager,
    IFeeManager
  >('FeeManager', 'FeeManagerLogicV1', feeManagerMsgData, deployer);

  console.log('FeeManager contract deployed at: ', feeManager.address);
  return feeManager;
}

async function deployAccessControl(deployer: SignerWithAddress) {
  const { contract: accessControl } =
    await deployContract<IGatewayAccessControl>(
      'GatewayAccessControl',
      {},
      null,
      deployer
    );
  console.log(
    'GatewayAccessControl contract deployed at: ',
    accessControl.address
  );
  return accessControl;
}

async function setupServices() {
  const [owner, feeManagerOwner] = await ethers.getSigners();

  const feeManagerContract = await deployFeeManager(feeManagerOwner);
  const smartWalletFactory = await deploySmartWalletFactory(owner);
  const tropykusContracts = await deployAndSetupTropykusContracts();
  const serviceTypeManager = await deployServiceTypeManager(owner);
  const accessControlContract = await deployAccessControl(owner);

  console.log('After access Control');
  // allow lending service interface id
  const tLx = await serviceTypeManager
    .connect(owner)
    .addServiceType(LENDING_SERVICE_INTERFACEID, { gasLimit: 3000000 });
  await tLx.wait();

  console.log('After adding lending service');
  // allow borrowing service interface id
  const tBx = await serviceTypeManager
    .connect(owner)
    .addServiceType(BORROW_SERVICE_INTERFACEID);
  await tBx.wait();

  console.log('After adding borrowing service');

  const RIFGatewayContract = await deployRIFGatewayContract(
    serviceTypeManager.address,
    feeManagerContract.address,
    accessControlContract.address,
    owner
  );
  console.log('After RIF Gateway deployment');

  // Emulate service provider implementation
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
    AccessControl: accessControlContract.address,
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
      collateralCurrency: NATIVE_CURRENCY,
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
      collateralCurrency: tropykusContracts.doc,
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
      collateralCurrency: NATIVE_CURRENCY,
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
      collateralCurrency: NATIVE_CURRENCY,
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
      collateralCurrency: NATIVE_CURRENCY,
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
      collateralCurrency: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'Tropykus Borrow Service',
      owner: ethers.constants.AddressZero,
    })
  ).wait();
}

setupServices().then(() => console.log('Done 🎉'));
