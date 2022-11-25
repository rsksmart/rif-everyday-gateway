import { expect } from '../../chairc';
import { ethers } from 'hardhat';
import { deployContract } from '../../utils/deployment.utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  ServiceTypeManager,
  RIFGateway,
  TropykusLendingService__factory,
  TropykusLendingService,
  TropykusBorrowingService__factory,
  TropykusBorrowingService,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('RIF Gateway', () => {
  let rifGateway: RIFGateway;
  let serviceTypeManager: ServiceTypeManager;
  let signer: SignerWithAddress;
  let otherSigner: SignerWithAddress;
  let tropykusLendingService: TropykusLendingService;
  let tropykusBorrowingService: TropykusBorrowingService;

  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const signer = signers[0];
    const otherSigner = signers[2];

    const { contract: serviceTypeManager } =
      await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory
      .connect(signer)
      .deploy(
        ethers.constants.AddressZero,
        ethers.constants.AddressZero
      )) as TropykusLendingService;

    await tropykusLendingService.deployed();

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory
      .connect(signer)
      .deploy(ethers.constants.AddressZero, {
        comptroller: ethers.constants.AddressZero,
        oracle: ethers.constants.AddressZero,
        crbtc: ethers.constants.AddressZero,
        cdoc: ethers.constants.AddressZero,
      })) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();

    const { contract: rifGateway } = await deployContract<RIFGateway>(
      'RIFGateway',
      {
        ServiceTypeManager: serviceTypeManager.address,
      }
    );

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

  describe('Gateway actions', () => {
    beforeEach(async () => {
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
    });

    it('Should add a new service', async () => {
      await expect(rifGateway.addService(tropykusLendingService.address)).to.not
        .be.reverted;
    });

    it('Should add multiple services for the same provider', async () => {
      await (
        await rifGateway.addService(tropykusLendingService.address)
      ).wait();

      await (
        await rifGateway.addService(tropykusBorrowingService.address)
      ).wait();

      const [services, providers] = await rifGateway.getServicesAndProviders();

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

      await expect(rifGateway.addService(tropykusLendingService.address)).to.be
        .reverted;
    });

    it('should emit an event to request providers validation', async () => {
      await (
        await rifGateway.addService(tropykusLendingService.address)
      ).wait();

      expect(await rifGateway.requestValidation(signer.address))
        .to.emit(rifGateway, 'ValidationRequested')
        .withArgs(signer.address);
    });

    it('should revert requesting validation when provider never added a service to RIFGateway', async () => {
      await expect(rifGateway.requestValidation(ethers.constants.AddressZero))
        .to.revertedWith('InvalidProvider')
        .withArgs(ethers.constants.AddressZero);
    });

    it('should validate a provider', async () => {
      await (
        await rifGateway.addService(tropykusLendingService.address)
      ).wait();

      const [services, providers] = await rifGateway.getServicesAndProviders();
      expect(services[0]).equals(tropykusLendingService.address);
      expect(services.length).equals(1);

      expect(providers.length).equals(1);
      expect(providers[0].provider).equals(signer.address);
      expect(providers[0].validated).equals(false);

      await (await rifGateway.validateProvider(signer.address)).wait();

      const [, afterProviders] = await rifGateway.getServicesAndProviders();
      expect(afterProviders[0].validated).equals(true);
    });

    it('should revert validate a provider when provider never added a service to RIFGateway', async () => {
      await expect(rifGateway.validateProvider(ethers.constants.AddressZero))
        .to.revertedWith('InvalidProvider')
        .withArgs(ethers.constants.AddressZero);
    });

    it('should remove a service', async () => {
      await (
        await rifGateway.addService(tropykusLendingService.address)
      ).wait();

      await (
        await rifGateway.addService(tropykusBorrowingService.address)
      ).wait();

      const [services, providers] = await rifGateway.getServicesAndProviders();
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

    it.skip('should remove a service and provider if ther are no more services from the provider', async () => {
      await (
        await rifGateway.addService(tropykusLendingService.address)
      ).wait();

      const [services, providers] = await rifGateway.getServicesAndProviders();
      expect(services[0]).equals(tropykusLendingService.address);
      expect(services.length).equals(1);

      expect(providers.length).equals(1);
      expect(providers[0].provider).equals(signer.address);
      expect(providers[0].validated).equals(false);

      await (
        await rifGateway.removeService(tropykusLendingService.address)
      ).wait();

      const [afterServices, afterProviders] =
        await rifGateway.getServicesAndProviders();
      console.log(afterServices);
      console.log(afterProviders);

      expect(afterServices.length).equals(0);
      expect(afterProviders.length).equals(0);
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
  });
});
