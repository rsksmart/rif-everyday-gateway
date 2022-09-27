import { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  TropykusLendingService,
  TropykusLendingService__factory,
  UserIdentityFactory,
  UserIdentityFactory__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Tropykus Lending Service', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let tropykusLendingService: TropykusLendingService;
  let userIdentity: UserIdentityFactory;
  const crbtc = '0x5b35072cd6110606c8421e013304110fa04a32a3';

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const userIdentityFactory = (await ethers.getContractFactory(
      'UserIdentityFactory'
    )) as UserIdentityFactory__factory;

    userIdentity = (await userIdentityFactory
      .connect(alice)
      .deploy()) as UserIdentityFactory;

    await userIdentity.deployed();

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory.deploy(
      crbtc,
      userIdentity.address
    )) as TropykusLendingService;

    await tropykusLendingService.deployed();

    await (
      await userIdentity
        .connect(alice)
        .authorize(tropykusLendingService.address, true)
    ).wait();
  });

  it.skip('should allow to lend RBTC on tropykus', async () => {
    await tropykusLendingService
      .connect(alice)
      .lend({ value: ethers.utils.parseEther('0.5') });

    const tropBalance = await tropykusLendingService
      .connect(alice)
      .getBalance();

    expect(+tropBalance / 1e18).to.be.equals(0.5);
  });

  it.skip('should allow to withdraw RBTC on tropykus', async () => {
    await tropykusLendingService
      .connect(alice)
      .lend({ value: ethers.utils.parseEther('0.5') });

    const aliceId = await userIdentity
      .connect(alice)
      .getIdentity(alice.address);

    const balanceTroBefore = await tropykusLendingService
      .connect(alice)
      .getBalance();

    expect(+balanceTroBefore / 1e18).to.be.equals(0.5);

    await tropykusLendingService.connect(alice).withdraw();

    const balanceTropAfter = await tropykusLendingService
      .connect(alice)
      .getBalance();

    expect(+balanceTropAfter / 1e18).to.be.equals(0);
  });
});
