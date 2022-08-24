import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import { DummyLendingService__factory } from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('DummyLendingService', () => {
  async function deployDummyLendingServiceFixture() {
    const [owner, ...otherUsers] = await ethers.getSigners();

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    const dummyLendingService = await lendingServiceFactory.deploy();

    return { dummyLendingService, owner };
  }

  it('should emit "Lend" event when lend is called', async () => {
    const amount: BigNumberish = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(
      dummyLendingService.lend(amount, currency, duration, payBackOption)
    )
      .to.emit(dummyLendingService, 'Lend')
      .withArgs(owner.address, currency);
  });

  it('should emit "Withdraw" event when withdraw is called', async () => {
    const amount = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;

    const { dummyLendingService, owner } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    await expect(dummyLendingService.withdraw(amount, currency))
      .to.emit(dummyLendingService, 'Withdraw')
      .withArgs(owner.address, currency);
  });

  it('should return "0" when getBalance is called', async () => {
    const currency = ethers.constants.AddressZero;

    const { dummyLendingService } = await loadFixture(
      deployDummyLendingServiceFixture
    );

    expect(await dummyLendingService.getBalance(currency)).to.equal(
      BigNumber.from(0)
    );
  });
});
