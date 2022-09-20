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
  const crbtc = '0xd406c55ad960b92e7f41517a84cb4b48557c3898';

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const userIdentityFactory = (await ethers.getContractFactory(
      'UserIdentityFactory'
    )) as UserIdentityFactory__factory;

    userIdentity = (await userIdentityFactory
      .connect(alice)
      .deploy()) as UserIdentityFactory;
    console.log('userIdentity:', userIdentity.address);

    const tropykusLendingServiceFactory = (await ethers.getContractFactory(
      'TropykusLendingService'
    )) as TropykusLendingService__factory;

    tropykusLendingService = (await tropykusLendingServiceFactory.deploy(
      crbtc,
      userIdentity.address
    )) as TropykusLendingService;
    console.log('topykusLendingService:', tropykusLendingService.address);

    await tropykusLendingService.deployed();

    await (
      await userIdentity
        .connect(alice)
        .authorize(tropykusLendingService.address, true)
    ).wait();
  });

  it('should allow to lend RBTC on tropykus', async () => {
    const balanceBefore =
      +(await ethers.provider.getBalance(alice.address)) / 1e18;
    console.log('balanceBefore', balanceBefore);
    await tropykusLendingService
      .connect(alice)
      .lend({ value: ethers.utils.parseEther('0.5') });
    const balanceAfter =
      +(await ethers.provider.getBalance(alice.address)) / 1e18;
    console.log('balanceAfter', balanceAfter);

    const tropBalance = await tropykusLendingService
      .connect(alice)
      .getBalance();
    console.log('balance:', +tropBalance / 1e18);

    expect(+tropBalance / 1e18).to.be.equals(0.5);
  });
});
