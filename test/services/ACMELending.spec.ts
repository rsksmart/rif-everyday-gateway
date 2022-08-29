import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';

const RBTC_ADDRESS = ethers.constants.AddressZero;
const RBTC_SENT = ethers.utils.parseEther('10');
const INTEREST_PER_100_BLOCKS = 10;

describe('Service Provider Lending Contract', () => {
  const initialFixture = async () => {
    const [owner, ...accounts] = await ethers.getSigners();
    const ACMELendingFactory = await ethers.getContractFactory('ACMELending');

    const contract = await ACMELendingFactory.deploy();

    await contract.deployed();

    return {
      owner,
      accounts,
      contract,
    };
  };

  describe('Deposits', () => {
    it('should allow deposit and emit Deposit event', async () => {
      const { owner, contract } = await loadFixture(initialFixture);

      expect(contract.deposit(RBTC_ADDRESS, 0, { value: RBTC_SENT }))
        .to.emit(contract, 'Deposit')
        .withArgs(owner.address, RBTC_SENT);
    });

    it('should fail if amount sent is 0', async () => {
      const ZERO_RBTC = ethers.constants.Zero;
      const { owner, contract } = await loadFixture(initialFixture);

      expect(
        contract.deposit(RBTC_ADDRESS, 0, { value: ZERO_RBTC })
      ).to.revertedWith('No amount sent');
    });

    it('should return balance 1000 blocks after deposit', async () => {
      const FAST_FORWARD_BLOCKS = 1000;
      const ACC_INTEREST = RBTC_SENT.mul(FAST_FORWARD_BLOCKS)
        .mul(INTEREST_PER_100_BLOCKS)
        .div(100 * 100);
      const { owner, contract } = await loadFixture(initialFixture);

      await contract.deposit(RBTC_ADDRESS, 0, { value: RBTC_SENT });

      expect(await contract.getBalance(RBTC_ADDRESS)).to.be.equals(RBTC_SENT);

      await hre.network.provider.send('hardhat_mine', [
        '0x' + FAST_FORWARD_BLOCKS.toString(16),
      ]);

      expect(await contract.getBalance(RBTC_ADDRESS)).to.be.equals(
        RBTC_SENT.add(ACC_INTEREST)
      );
    });

    it('should withdraw 1 RBTC of interest after 100 blocks', async () => {
      const FAST_FORWARD_BLOCKS = 100;
      const ACC_INTEREST = RBTC_SENT.mul(FAST_FORWARD_BLOCKS)
        .mul(INTEREST_PER_100_BLOCKS)
        .div(100 * 100);
      const { owner, contract } = await loadFixture(initialFixture);
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );

      await (
        await contract.deposit(RBTC_ADDRESS, 0, { value: RBTC_SENT })
      ).wait();

      expect(
        (await ethers.provider.getBalance(owner.address)).lt(
          initialOwnerBalance
        )
      ).to.be.true;

      expect(await contract.getBalance(RBTC_ADDRESS)).to.be.equals(RBTC_SENT);

      await hre.network.provider.send('hardhat_mine', [
        '0x' + FAST_FORWARD_BLOCKS.toString(16),
      ]);

      const balanceOnContract = await contract.getBalance(RBTC_ADDRESS);

      expect(contract.withdraw(RBTC_ADDRESS, balanceOnContract))
        .to.emit(contract, 'Withdraw')
        .withArgs(owner.address, RBTC_SENT.add(ACC_INTEREST));

      expect(await contract.getBalance(owner.address)).to.be.equals(0);
    });
  });
});
