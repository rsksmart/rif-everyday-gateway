import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { BigNumber, BigNumberish } from 'ethers';
import { DummyLendingService } from '../../typechain-types';
import { DummyLendingService__factory } from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('DummyLendingService', () => {
  let dummyLendingService: DummyLendingService;
  let owner: SignerWithAddress;
  let otherUsers: SignerWithAddress[];

  beforeEach(async () => {
    [owner, ...otherUsers] = await ethers.getSigners();

    const lendingServiceFactory = (await ethers.getContractFactory(
      'DummyLendingService'
    )) as DummyLendingService__factory;

    dummyLendingService = await lendingServiceFactory.deploy();
  });

  it('should emit "Lend" event when lend is called', async () => {
    const amount: BigNumberish = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;
    const duration = ethers.constants.One;
    const payBackOption = ethers.constants.One;

    await expect(
      dummyLendingService.lend(amount, currency, duration, payBackOption)
    )
      .to.emit(dummyLendingService, 'Lend')
      .withArgs(owner.address, currency);
  });

  it('should emit "Withdraw" event when withdraw is called', async () => {
    const amount = ethers.constants.Two;
    const currency = ethers.constants.AddressZero;

    await expect(dummyLendingService.withdraw(amount, currency))
      .to.emit(dummyLendingService, 'Withdraw')
      .withArgs(owner.address, currency);
  });

  it('should return "0" when getBalance is called', async () => {
    const currency = ethers.constants.AddressZero;

    expect(await dummyLendingService.getBalance(currency)).to.equal(
      BigNumber.from(0)
    );
  });
});
