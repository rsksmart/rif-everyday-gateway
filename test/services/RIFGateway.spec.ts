import { expect } from '../../chairc';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  ServiceTypeManager,
  TropykusLendingService__factory,
  TropykusLendingService,
  TropykusBorrowingService__factory,
  TropykusBorrowingService,
  IRIFGateway,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployRIFGateway } from './utils';
import {
  BORROW_SERVICE_INTERFACEID as BORROW_SERVICE_INTERFACE_ID,
  LENDING_SERVICE_INTERFACEID as LENDING_SERVICE_INTERFACE_ID,
} from 'test/utils/interfaceIDs';

describe('RIF Gateway', () => {
  let rifGateway: IRIFGateway;
  let serviceTypeManager: ServiceTypeManager;
  let signer: SignerWithAddress;
  let otherSigner: SignerWithAddress;
  let tropykusLendingService: TropykusLendingService;
  let tropykusBorrowingService: TropykusBorrowingService;

  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const signer = signers[0];
    const otherSigner = signers[2];

    ({ RIFGateway: rifGateway, serviceTypeManager: serviceTypeManager } =
      await deployRIFGateway(false));

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory
      .connect(signer)
      .deploy(rifGateway.address, ethers.constants.AddressZero, {
        comptroller: ethers.constants.AddressZero,
        crbtc: ethers.constants.AddressZero,
      })) as TropykusLendingService;

    await tropykusLendingService.deployed();

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory
      .connect(signer)
      .deploy(rifGateway.address, ethers.constants.AddressZero, {
        comptroller: ethers.constants.AddressZero,
        oracle: ethers.constants.AddressZero,
        crbtc: ethers.constants.AddressZero,
        cdoc: ethers.constants.AddressZero,
      })) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();

    return {
      rifGateway,
      serviceTypeManager,
      tropykusLendingService,
      signer,
      otherSigner,
    };
  };

  beforeEach(async () => {
    ({
      rifGateway,
      serviceTypeManager,
      tropykusLendingService,
      signer,
      otherSigner,
    } = await loadFixture(initialFixture));
  });

  it('Should not add a new service if the service type is not supported', async () => {
    await expect(rifGateway.addService(tropykusLendingService.address)).to.be
      .reverted;
  });

  describe('RIFGateway', () => {
    beforeEach(async () => {
      // allow lending service interface id
      const tLx = await serviceTypeManager.addServiceType(
        LENDING_SERVICE_INTERFACE_ID
      );
      await tLx.wait();

      // allow borrowing service interface id

      const tBx = await serviceTypeManager.addServiceType(
        BORROW_SERVICE_INTERFACE_ID
      );
      await tBx.wait();
    });

    describe('addService', () => {
      it('Should add a new service', async () => {
        await expect(rifGateway.addService(tropykusLendingService.address)).to
          .not.be.reverted;
      });

      it('Should add multiple services for the same provider', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await (
          await rifGateway.addService(tropykusBorrowingService.address)
        ).wait();

        const [services, providers] =
          await rifGateway.getServicesAndProviders();

        expect(services[0]).equals(tropykusLendingService.address);
        expect(services[1]).equals(tropykusBorrowingService.address);
        expect(services.length).equals(2);

        expect(providers.length).equals(1);
        expect(providers[0].provider).equals(signer.address);
        expect(providers[0].validated).equals(false);
      });

      it('should not allow to add duplicated services', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await expect(rifGateway.addService(tropykusLendingService.address))
          .to.revertedWith('DuplicatedService')
          .withArgs(tropykusLendingService.address);
      });
    });

    describe('requestValidation', () => {
      it('should request validation for a provider with no services added', async () => {
        await (await rifGateway.requestValidation(signer.address)).wait();

        const [, lastProvider] = await rifGateway.getServicesAndProviders();
        expect(lastProvider[0].provider).equal(signer.address);
      });

      it('should request validation for a provider with registered services', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await (await rifGateway.requestValidation(signer.address)).wait();

        const [, lastProvider] = await rifGateway.getServicesAndProviders();
        expect(lastProvider[0].provider).equal(signer.address);
      });

      it('should emit an event to request providers validation', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await expect(rifGateway.requestValidation(signer.address))
          .to.emit(rifGateway, 'ValidationRequested')
          .withArgs(signer.address);
      });
    });
    describe.only('validateProvider', () => {
      it('should validate a provider when no services have been added by the provider', async () => {
        await (await rifGateway.requestValidation(signer.address)).wait();
        await (await rifGateway.validateProvider(signer.address)).wait();

        const [, afterProviders] = await rifGateway.getServicesAndProviders();
        expect(afterProviders[0].validated).equals(true);
      });

      it('should validate a provider when a service has been added', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        const [services, providers] =
          await rifGateway.getServicesAndProviders();
        expect(services[0]).equals(tropykusLendingService.address);
        expect(services.length).equals(1);

        expect(providers.length).equals(1);
        expect(providers[0].provider).equals(signer.address);
        expect(providers[0].validated).equals(false);

        await (await rifGateway.validateProvider(signer.address)).wait();

        const [, afterProviders] = await rifGateway.getServicesAndProviders();
        expect(afterProviders[0].validated).equals(true);
      });

      it('should revert if validation was not requested before', async () => {
        await expect(rifGateway.validateProvider(ethers.constants.AddressZero))
          .to.revertedWith('ValidationNotRequested')
          .withArgs(ethers.constants.AddressZero);
      });
    });

    describe('removeService', () => {
      it('should remove a service', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await (
          await rifGateway.addService(tropykusBorrowingService.address)
        ).wait();

        const [services, providers] =
          await rifGateway.getServicesAndProviders();
        expect(services[0]).equals(tropykusLendingService.address);
        expect(services[1]).equals(tropykusBorrowingService.address);
        expect(services.length).equals(2);

        expect(providers.length).equals(1);
        expect(providers[0].provider).equals(signer.address);
        expect(providers[0].validated).equals(false);

        await (
          await rifGateway.removeService(tropykusLendingService.address)
        ).wait();

        const [afterServices, afterProviders] =
          await rifGateway.getServicesAndProviders();

        expect(afterServices[0]).equals(tropykusBorrowingService.address);
        expect(afterServices.length).equals(1);

        expect(afterProviders.length).equals(1);
        expect(afterProviders[0].provider).equals(signer.address);
        expect(afterProviders[0].validated).equals(false);
      });

      it('should revert on remove a service if caller is not service owner', async () => {
        await (
          await rifGateway.addService(tropykusLendingService.address)
        ).wait();

        await expect(
          rifGateway
            .connect(otherSigner)
            .removeService(tropykusLendingService.address)
        )
          .to.revertedWith('InvalidProviderAddress')
          .withArgs(otherSigner.address);
      });

      it('should revert if trying to delete a service that does not exist', async () => {
        await expect(
          rifGateway
            .connect(signer)
            .removeService(tropykusLendingService.address)
        )
          .to.revertedWith('InvalidService')
          .withArgs(tropykusLendingService.address);
      });
    });
  });
});
