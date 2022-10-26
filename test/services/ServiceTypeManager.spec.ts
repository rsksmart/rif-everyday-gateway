import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import ILendingServiceJson from '../../artifacts/contracts/services/ILendingService.sol/ILendingService.json';
import { deployContract } from 'utils/deployment.utils';
import { deployMockContract } from 'test/utils/mock.utils';
import { $ServiceTypeManager } from '../../typechain-types/contracts-exposed/services/ServiceTypeManager.sol/$ServiceTypeManager';
import { expect } from 'chairc';
import { ILendingService } from '../../typechain-types/contracts/services/ILendingService';

// const SERVICE_TYPE_NAME = 'Lending';
const SERVICE_TYPE_INTERFACE_ID = '0x01ffc9a7';
const UNIMPLEMENTED_SERVICE_TYPE_INTERFACE_ID = '0x01ffc6f2';

describe('Service Type Manager', () => {
  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const gatewayOwner = signers[0];
    const serviceOwner = signers[1];

    const { contract: ServiceTypeManager } =
      await deployContract<$ServiceTypeManager>('$ServiceTypeManager', {});

    return {
      ServiceTypeManager,
      gatewayOwner,
      serviceOwner,
    };
  };

  it('Should add a new service type', async () => {
    const { ServiceTypeManager } = await loadFixture(initialFixture);

    const tx = await ServiceTypeManager.addServiceType(
      SERVICE_TYPE_INTERFACE_ID
    );

    await tx.wait();

    const serviceType = await ServiceTypeManager.supportsInterface(
      SERVICE_TYPE_INTERFACE_ID
    );

    expect(serviceType).to.be.true;
  });

  it('Should return true if the interface is supported', async () => {
    const { ServiceTypeManager } = await loadFixture(initialFixture);

    const tx = await ServiceTypeManager.addServiceType(
      SERVICE_TYPE_INTERFACE_ID
    );

    await tx.wait();

    expect(
      await ServiceTypeManager.supportsInterface(SERVICE_TYPE_INTERFACE_ID)
    ).to.be.true;
  });

  it('Should return false when the service type does not exist on the service type manager', async () => {
    const { ServiceTypeManager } = await loadFixture(initialFixture);

    expect(
      await ServiceTypeManager.supportsInterface(
        UNIMPLEMENTED_SERVICE_TYPE_INTERFACE_ID
      )
    ).to.be.false;
  });
});
