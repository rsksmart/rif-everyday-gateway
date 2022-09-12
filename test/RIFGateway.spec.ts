import { expect } from 'chairc';
import { ethers } from 'hardhat';
import {
  ACME,
  ACME__factory,
  DummyBorrowService,
  DummyBorrowService__factory,
  DummyLendingService,
  DummyLendingService__factory,
  Providers,
  Providers__factory,
} from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('RIFGateway', () => {
  let gatewaySigner: SignerWithAddress;
  let acmeSigner: SignerWithAddress;
  let alice: SignerWithAddress;
  let providers: Providers;
  let acme: ACME;
  let borrowService: DummyBorrowService;
  let lendingService: DummyLendingService;

  beforeEach(async () => {
    [gatewaySigner, acmeSigner, alice] = await ethers.getSigners();

    const ProvidersFactory = (await ethers.getContractFactory(
      'Providers'
    )) as Providers__factory;

    providers = await ProvidersFactory.connect(gatewaySigner).deploy();

    await providers.deployed();

    const ACMEFactory = (await ethers.getContractFactory(
      'ACME'
    )) as ACME__factory;

    acme = await ACMEFactory.connect(acmeSigner).deploy();

    await acme.deployed();

    const borrowServiceFactory = (await ethers.getContractFactory(
      'DummyBorrowService'
    )) as DummyBorrowService__factory;

    borrowService = (await borrowServiceFactory
      .connect(acmeSigner)
      .deploy(acme.address)) as DummyBorrowService;

    await borrowService.deployed();

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    lendingService = (await lendingServiceFactory
      .connect(acmeSigner)
      .deploy(acme.address)) as DummyLendingService;

    await lendingService.deployed();
  });
  it('should add a service to pending validation', async () => {
    await providers.connect(acmeSigner).addService(lendingService.address);
  });
  it('should validate a service provider');
  it('should return all lending services');
  it('should return all borrowing services');
});
