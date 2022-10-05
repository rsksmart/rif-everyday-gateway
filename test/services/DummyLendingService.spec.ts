import { expect } from 'chairc';
import { ethers, network } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import { ACME__factory, DummyLendingService__factory } from 'typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { DummyLendingService } from 'typechain-types';

describe('DummyLendingService', () => {
  const INTEREST_PER_100_BLOCKS = 10;
  async function deployDummyLendingServiceFixture() {
    const [owner] = await ethers.getSigners();

    const acmeFactory = (await ethers.getContractFactory(
      'ACME'
    )) as ACME__factory;

    const acme = await acmeFactory.deploy();

    await acme.deployed();

    // Add initial liquidity of 100 RBTC
    await owner.sendTransaction({
      to: acme.address,
      value: ethers.utils.parseEther('100'),
    });

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    const dummyLendingService = (await lendingServiceFactory.deploy(
      acme.address
    )) as DummyLendingService;

    await dummyLendingService.deployed();

    return { acmeLending: acme, dummyLendingService, owner };
  }
  it('should revert with InvalidAmount(0) when lend is called with 0 amount', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.lend()).to.be.revertedWith(
      'InvalidAmount(0)'
    );
  });

  it('should not revert when lend is called with a proper amount', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;
    const amount: BigNumberish = ethers.constants.Two;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.lend({ value: amount })).to.not.be
      .reverted;
  });

  it('should emit "Lend" event when lend is called with a proper amount', async () => {
    const amount: BigNumberish = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.lend({ value: amount }))
      .to.emit(dummyLendingService, 'Lend')
      .withArgs(0, owner.address, currency, amount);
  });

  it('should emit "Withdraw" event when withdraw is called', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;
    const currency = ethers.constants.AddressZero;

    const RBTC_DEPOSIT = ethers.utils.parseEther('10');

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.lend({ value: RBTC_DEPOSIT })).to.be
      .fulfilled;

    // Fast forward 100 blocks
    await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);

    const FAST_FORWARD_BLOCKS = 101;
    const ACC_INTEREST = RBTC_DEPOSIT.mul(FAST_FORWARD_BLOCKS)
      .mul(INTEREST_PER_100_BLOCKS)
      .div(100 * 100);
    const totalBalance = ACC_INTEREST.add(RBTC_DEPOSIT);

    await expect(dummyLendingService.withdraw())
      .to.emit(dummyLendingService, 'Withdraw')
      .withArgs(0, owner.address, currency, totalBalance);
  });

  it('should return "0" when getBalance is called', async () => {
    const { dummyLendingService } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    expect(
      await dummyLendingService.getBalance(ethers.constants.AddressZero)
    ).to.equal(BigNumber.from(0));
  });

  it('should return 10 RBTC + interest when getBalance is called after 100 blocks', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const RBTC_DEPOSIT = ethers.utils.parseEther('10');

    const { dummyLendingService } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.lend({ value: RBTC_DEPOSIT })).to.be
      .fulfilled;

    // Fast forward 100 blocks
    await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);

    expect(
      (await dummyLendingService.getBalance(ethers.constants.AddressZero)).gt(
        RBTC_DEPOSIT
      )
    ).to.be.true;
  });
});
