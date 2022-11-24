import { expect } from '../../chairc';
import { ethers } from 'hardhat';
import { deployContract } from '../../utils/deployment.utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {
  ServiceTypeManager,
  RIFGateway,
  TropykusLendingService__factory,
  TropykusLendingService,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('RIF Gateway', () => {
  let rifGateway: RIFGateway;
  let serviceTypeManager: ServiceTypeManager;
  let signer: SignerWithAddress;
  let tropykusLendingService: TropykusLendingService;

  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const signer = signers[0];

    const { contract: serviceTypeManager } =
      await deployContract<ServiceTypeManager>('ServiceTypeManager', {});

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory.deploy(
      ethers.constants.AddressZero,
      ethers.constants.AddressZero
    )) as TropykusLendingService;

    await tropykusLendingService.deployed();

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
    };
  };

  beforeEach(async () => {
    ({ rifGateway, serviceTypeManager, tropykusLendingService, signer } =
      await loadFixture(initialFixture));
  });

  it('Should add a new service', async () => {
    // allow lending service interface id
    const LENDING_SERVICE_INTERFACEID = '0xd9eedeca';
    const tLx = await serviceTypeManager.addServiceType(
      LENDING_SERVICE_INTERFACEID
    );
    tLx.wait();

    await expect(rifGateway.addService(tropykusLendingService.address)).to.not
      .be.reverted;
  });

  it('Should not add a new service if the service type is not supported', async () => {
    await expect(rifGateway.addService(tropykusLendingService.address)).to.be
      .reverted;
  });

  it('Should add multiple services for the same provider', async () => {
    // allow lending service interface id
    const LENDING_SERVICE_INTERFACEID = '0xd9eedeca';
    const tLx = await serviceTypeManager.addServiceType(
      LENDING_SERVICE_INTERFACEID
    );
    tLx.wait();

    const tx = await rifGateway.addService(tropykusLendingService.address);
    await tx.wait();

    // await expect(rifGateway.addService(tropykusLendingService.address)).to.be
    //   .reverted;

    const [services, providers] = await rifGateway.getServicesAndProviders();
    expect(services[0]).equals(tropykusLendingService.address);
    expect(providers[0].provider).equals(await tropykusLendingService.owner());
    expect(providers[0].validated).equals(false);
  });
});
