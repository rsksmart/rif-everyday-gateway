import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import {
  ACMELending__factory,
  DummyLendingService__factory,
} from '../../typechain-types';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('DummyLendingService', () => {
  async function deployDummyLendingServiceFixture() {
    const [owner] = await ethers.getSigners();

    const acmeLendingFactory = (await ethers.getContractFactory(
      'ACMELending'
    )) as ACMELending__factory;

    const acmeLending = await acmeLendingFactory.deploy();

    await acmeLending.deployed();

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    const dummyLendingService = await lendingServiceFactory.deploy(
      acmeLending.address
    );

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

  //
  // it('should emit "Withdraw" event when withdraw is called', async () => {
  //   const amount = ethers.constants.Two;
  //   const currency = ethers.constants.AddressZero;
  //
  //   const { dummyLendingService, owner } = await loadFixture(
  //     deployDummyLendingServiceFixture
  //   );
  //
  //   await expect(dummyLendingService.withdraw(amount))
  //     .to.emit(dummyLendingService, 'Withdraw')
  //     .withArgs(owner.address, currency);
  // });
  //
  // it('should return "0" when getBalance is called', async () => {
  //   const { dummyLendingService } = await loadFixture(
  //     deployDummyLendingServiceFixture
  //   );
  //
  //   expect(await dummyLendingService.getBalance()).to.equal(BigNumber.from(0));
  // });
});
