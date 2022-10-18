import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import DummyLendingServiceJson from '../../artifacts/contracts/mocks/DummyLendingService.sol/DummyLendingService.json';
import AcmeJson from '../../artifacts/contracts/mocks/ACME.sol/ACME.json';
import { deployContract } from 'utils/deployment.utils';
import { deployMockContract } from 'test/utils/mock.utils';
import { arrayify, toUtf8Bytes } from 'ethers/lib/utils';
import { $ServiceTypeManager } from '../../typechain-types/contracts-exposed/services/ServiceTypeManager.sol/$ServiceTypeManager';
import { IService } from '../../typechain-types/contracts/services/IService';
import { expect } from 'chairc';
import {
  ACME,
  DummyLendingService,
} from '../../typechain-types/contracts/mocks';

const SERVICE_TYPE_NAME = 'Lending';
const SERVICE_TYPE_INTERFACE_ID = '0x01ffc9a7';

describe('Service Type Manager', () => {
  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const gatewayOwner = signers[0];
    const serviceOwner = signers[1];

    const { contract: ServiceTypeManager } =
      await deployContract<$ServiceTypeManager>('$ServiceTypeManager', {});

    const DummyLendingService = await deployMockContract<DummyLendingService>(
      serviceOwner,
      DummyLendingServiceJson.abi
    );

    return {
      ServiceTypeManager,
      DummyLendingService,
      gatewayOwner,
      serviceOwner,
    };
  };

  it('Should add a new service type', async () => {
    const { ServiceTypeManager, DummyLendingService } = await loadFixture(
      initialFixture
    );

    const tx = await ServiceTypeManager.addServiceType(
      SERVICE_TYPE_NAME,
      SERVICE_TYPE_INTERFACE_ID
    );

    await tx.wait();

    const serviceType = await ServiceTypeManager.serviceTypes(
      SERVICE_TYPE_INTERFACE_ID
    );

    expect(serviceType).to.equal(SERVICE_TYPE_NAME);
  });

  it('Should return true if the service implements the interface', async () => {
    const { ServiceTypeManager, DummyLendingService } = await loadFixture(
      initialFixture
    );

    const tx = await ServiceTypeManager.addServiceType(
      SERVICE_TYPE_NAME,
      SERVICE_TYPE_INTERFACE_ID
    );

    await tx.wait();

    const serviceType = await ServiceTypeManager.serviceTypes(
      SERVICE_TYPE_INTERFACE_ID
    );

    expect(serviceType).to.equal(SERVICE_TYPE_NAME);

    await DummyLendingService.mock.supportsInterface.returns(true);
    await DummyLendingService.mock.getServiceType.returns(
      arrayify(SERVICE_TYPE_INTERFACE_ID)
    );

    expect(
      await ServiceTypeManager.supportsService(DummyLendingService.address)
    ).to.be.true;
  });

  it('Should return false if the service does not implement the interface', async () => {
    const { ServiceTypeManager, DummyLendingService } = await loadFixture(
      initialFixture
    );

    const tx = await ServiceTypeManager.addServiceType(
      SERVICE_TYPE_NAME,
      SERVICE_TYPE_INTERFACE_ID
    );

    await tx.wait();

    const serviceType = await ServiceTypeManager.serviceTypes(
      SERVICE_TYPE_INTERFACE_ID
    );

    expect(serviceType).to.equal(SERVICE_TYPE_NAME);

    await DummyLendingService.mock.supportsInterface.returns(false);
    await DummyLendingService.mock.getServiceType.returns(
      arrayify(SERVICE_TYPE_INTERFACE_ID)
    );

    expect(
      await ServiceTypeManager.supportsService(DummyLendingService.address)
    ).to.be.false;
  });
});