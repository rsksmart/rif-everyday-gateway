import { expect } from 'chairc';
import { ethers, network } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import {
  ACMELending__factory,
  DummyLendingService__factory,
} from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { DummyLendingService } from 'typechain-types/contracts/Mocks';

describe('DummyLendingService', () => {
  const INTEREST_PER_100_BLOCKS = 10;
  async function deployDummyLendingServiceFixture() {
    const [owner] = await ethers.getSigners();

    const acmeLendingFactory = (await ethers.getContractFactory(
      'ACMELending'
    )) as ACMELending__factory;

    const acmeLending = await acmeLendingFactory.deploy();

    await acmeLending.deployed();

    // Add initial liquidity of 100 RBTC
    await owner.sendTransaction({
      to: acmeLending.address,
      value: ethers.utils.parseEther('100'),
    });

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    const dummyLendingService = (await lendingServiceFactory.deploy(
      acmeLending.address
    )) as DummyLendingService;

    await dummyLendingService.deployed();

    return { acmeLending, dummyLendingService, owner };
  }
  it('should revert with InvalidAmount(0) when lend is called with 0 amount', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(duration, payBackOption)
    ).to.be.revertedWith('InvalidAmount(0)');
  });

  it('should not revert when lend is called with a proper amount', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;
    const amount: BigNumberish = ethers.constants.Two;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(duration, payBackOption, { value: amount })
    ).to.not.be.reverted;
  });

  it('should emit "Lend" event when lend is called with a proper amount', async () => {
    const amount: BigNumberish = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(duration, payBackOption, { value: amount })
    )
      .to.emit(dummyLendingService, 'Lend')
      .withArgs(owner.address, currency, amount);
  });

  it('should emit "Withdraw" event when withdraw is called', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;
    const currency = ethers.constants.AddressZero;

    const RBTC_DEPOSIT = ethers.utils.parseEther('10');

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(duration, payBackOption, { value: RBTC_DEPOSIT })
    ).to.be.fulfilled;

    // Fast forward 100 blocks
    await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);

    const FAST_FORWARD_BLOCKS = 101;
    const ACC_INTEREST = RBTC_DEPOSIT.mul(FAST_FORWARD_BLOCKS)
      .mul(INTEREST_PER_100_BLOCKS)
      .div(100 * 100);
    const totalBalance = ACC_INTEREST.add(RBTC_DEPOSIT);

    await expect(dummyLendingService.withdraw())
      .to.emit(dummyLendingService, 'Withdraw')
      .withArgs(owner.address, currency, totalBalance);
  });

  it('should return "0" when getBalance is called', async () => {
    const { dummyLendingService } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    expect(await dummyLendingService.getBalance()).to.equal(BigNumber.from(0));
  });

  it('should return 10 RBTC + interest when getBalance is called after 100 blocks', async () => {
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const RBTC_DEPOSIT = ethers.utils.parseEther('10');

    const { dummyLendingService } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(duration, payBackOption, { value: RBTC_DEPOSIT })
    ).to.be.fulfilled;

    // Fast forward 100 blocks
    await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);

    expect((await dummyLendingService.getBalance()).gt(RBTC_DEPOSIT)).to.be
      .true;
  });
});
