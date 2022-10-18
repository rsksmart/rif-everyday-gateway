import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import {
  IService,
  // ServiceTypeManager,
  // ServiceTypeManager__factory,
} from 'typechain-types';
import Service from 'artifacts/contracts/services/Service.sol/Service.json';
import { deployContract, Factory } from 'utils/deployment.utils';
import { deployMockContract } from 'test/utils/mock.utils';
import { $ServiceTypeManager } from 'typechain-types/contracts-exposed/services/ServiceTypeManager.sol/$ServiceTypeManager';
import { toUtf8Bytes } from 'ethers/lib/utils';

describe('Service Type Manager', () => {
  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const gatewayOwner = signers[0];
    const serviceOwner = signers[1];

    const { contract: ServiceTypeManager } =
      await deployContract<$ServiceTypeManager>(
        '$ServiceTypeManager',
        {},
        (await ethers.getContractFactory(
          '$ServiceTypeManager',
          {}
        )) as Factory<$ServiceTypeManager>
      );

    const MockService = await deployMockContract<IService>(
      serviceOwner,
      Service.abi
    );

    return {
      ServiceTypeManager,
      MockService,
      gatewayOwner,
      serviceOwner,
    };
  };

  it('Should add a new service type', async () => {
    const {
      ServiceTypeManager,
      // MockService,
      // gatewayOwner,
      // serviceOwner
    } = await loadFixture(initialFixture);

    const tx = await ServiceTypeManager.addServiceType(
      'Lending',
      '0x01ffc9a7'
    ).then(async (t) => await t.wait());
    const serviceType = await ServiceTypeManager.serviceTypes(
      toUtf8Bytes('0x01ffc9a7')
    );
    console.log(serviceType);

    // expect(serviceType.name).to.equal('0x01ffc9a7');
  });
});
