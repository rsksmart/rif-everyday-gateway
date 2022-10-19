import { expect } from '../../chairc';
import { ethers } from 'hardhat';
import { deployContract } from '../../utils/deployment.utils';
import { $Providers } from '../../typechain-types/contracts-exposed/services/Providers.sol/$Providers';
import { deployMockContract } from '../utils/mock.utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import ServiceTypeManagerJson from '../../artifacts/contracts-exposed/services/ServiceTypeManager.sol/$ServiceTypeManager.json';
import LendingServiceJson from '../../artifacts/contracts-exposed/services/LendingService.sol/$LendingService.json';
import { $ServiceTypeManager } from '../../typechain-types/contracts-exposed/services/ServiceTypeManager.sol/$ServiceTypeManager';
import { $LendingService } from '../../typechain-types/contracts-exposed/services/LendingService.sol/$LendingService';

// const SERVICE_TYPE_NAME = 'Lending';
// const SERVICE_TYPE_INTERFACE_ID = '0x01ffc9a7';

describe('Providers', () => {
  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const signer = signers[0];

    const ServiceTypeManager = await deployMockContract<$ServiceTypeManager>(
      signer,
      ServiceTypeManagerJson.abi
    );

    const LendingService = await deployMockContract<$LendingService>(
      signer,
      LendingServiceJson.abi
    );

    const { contract: Providers } = await deployContract<$Providers>(
      '$Providers',
      {
        ServiceTypeManager: ServiceTypeManager.address,
      }
    );

    return {
      Providers,
      ServiceTypeManager,
      LendingService,
      signer,
    };
  };

  it('Should add a new service', async () => {
    const { Providers, ServiceTypeManager, LendingService, signer } =
      await loadFixture(initialFixture);

    await ServiceTypeManager.mock.supportsService.returns(true);
    await LendingService.mock.owner.returns(signer.address);

    await expect(Providers.addService(LendingService.address)).to.not.be
      .reverted;
  });

  it('Should not add a new service if the service type is not supported', async () => {
    const { Providers, ServiceTypeManager, LendingService, signer } =
      await loadFixture(initialFixture);

    await ServiceTypeManager.mock.supportsService.returns(false);
    await LendingService.mock.owner.returns(signer.address);

    await expect(Providers.addService(LendingService.address)).to.be.reverted;
  });

  it('Should not add a new service if the service owner is address zero', async () => {
    const { Providers, ServiceTypeManager, LendingService, signer } =
      await loadFixture(initialFixture);

    await ServiceTypeManager.mock.supportsService.returns(true);
    await LendingService.mock.owner.returns(ethers.constants.AddressZero);

    await expect(Providers.addService(LendingService.address)).to.be.reverted;
  });

  // it('Should add multiple services for the same provider', async () => {
  //   const { Providers, ServiceTypeManager, LendingService, signer } =
  //     await loadFixture(initialFixture);
  //
  //   await ServiceTypeManager.mock.supportsService.returns(true);
  //   await LendingService.mock.owner.returns(signer.address);
  //
  //   const tx = await Providers.addService(LendingService.address);
  //
  //   await tx.wait();
  //
  //   await expect(Providers.addService(LendingService.address)).to.not.be
  //     .reverted;
  // });

  // it('Should return all services', async () => {
  //   const { Providers, ServiceTypeManager, LendingService, signer } =
  //     await loadFixture(initialFixture);
  //
  //   await ServiceTypeManager.mock.supportsService.returns(true);
  //   await LendingService.mock.owner.returns(signer.address);
  //
  //   let tx = await Providers.addService(LendingService.address);
  //   await tx.wait();
  //
  //   tx = await Providers.validate(true, LendingService.address);
  //   await tx.wait();
  //
  //   tx = await Providers.addService(LendingService.address);
  //   await tx.wait();
  //
  //   const services = await Providers.getServices();
  //
  //   expect(services).to.deep.equal([
  //     LendingService.address,
  //     LendingService.address,
  //   ]);
  // });
});
