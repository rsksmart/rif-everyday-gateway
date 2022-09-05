import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ACME,
  ACME__factory,
  ERC677,
  ERC677__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const RBTC_SENT = ethers.utils.parseEther('10');
const INTEREST_PER_100_BLOCKS = 10;

describe('Service Provider Lending Contract', () => {
  const initialFixture = async () => {
    const [owner, ...accounts] = await ethers.getSigners();
    const ACMEFactory = (await ethers.getContractFactory(
      'ACME'
    )) as ACME__factory;

    const contract = await ACMEFactory.deploy();

    await contract.deployed();

    // Add initial liquidity of 100 RBTC
    await owner.sendTransaction({
      to: contract.address,
      value: ethers.utils.parseEther('100'),
    });

    return {
      owner,
      accounts,
      contract,
    };
  };

  describe('Deposits', () => {
    it('should allow deposit and emit Deposit event', async () => {
      const { owner, contract } = await loadFixture(initialFixture);

      expect(contract['deposit()']({ value: RBTC_SENT }))
        .to.emit(contract, 'Deposit')
        .withArgs(owner.address, RBTC_SENT);
    });

    it('should fail if amount sent is 0', async () => {
      const ZERO_RBTC = ethers.constants.Zero;
      const { contract } = await loadFixture(initialFixture);

      expect(contract['deposit()']({ value: ZERO_RBTC })).to.revertedWith(
        'InvalidAmount(0)'
      );
    });

    it('should return balance 1000 blocks after deposit', async () => {
      const FAST_FORWARD_BLOCKS = 1000;
      const ACC_INTEREST = RBTC_SENT.mul(FAST_FORWARD_BLOCKS)
        .mul(INTEREST_PER_100_BLOCKS)
        .div(100 * 100);
      const { contract } = await loadFixture(initialFixture);

      await contract['deposit()']({ value: RBTC_SENT });

      let balance = await contract['getBalance()']();

      expect(balance.deposited).to.be.equals(RBTC_SENT);
      expect(balance.interest).to.be.equals(ethers.constants.Zero);

      await hre.network.provider.send('hardhat_mine', [
        '0x' + FAST_FORWARD_BLOCKS.toString(16),
      ]);

      balance = await contract['getBalance()']();

      expect(balance.deposited).to.be.equals(RBTC_SENT);
      expect(balance.interest).to.be.equals(ACC_INTEREST);
    });

    it('should withdraw 1 RBTC of interest after 100 blocks', async () => {
      const FAST_FORWARD_BLOCKS = 100;
      const ACC_INTEREST = async (initialBlock: number) =>
        RBTC_SENT.mul((await ethers.provider.getBlockNumber()) - initialBlock)
          .mul(INTEREST_PER_100_BLOCKS)
          .div(100 * 100);
      const { owner, contract } = await loadFixture(initialFixture);
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );

      await (await contract['deposit()']({ value: RBTC_SENT })).wait();
      const blockOnDeposit = await ethers.provider.getBlockNumber();

      expect(
        (await ethers.provider.getBalance(owner.address)).lt(
          initialOwnerBalance
        )
      ).to.be.true;

      let balanceOnContract = await contract['getBalance()']();
      expect(balanceOnContract.deposited).to.be.equals(RBTC_SENT);
      expect(balanceOnContract.interest).to.be.equals(ethers.constants.Zero);

      await hre.network.provider.send('hardhat_mine', [
        '0x' + FAST_FORWARD_BLOCKS.toString(16),
      ]);

      balanceOnContract = await contract['getBalance()']();
      expect(balanceOnContract.deposited).to.be.equals(RBTC_SENT);
      expect(balanceOnContract.interest).to.be.equals(
        await ACC_INTEREST(blockOnDeposit)
      );

      expect(await contract['withdraw(uint256)'](balanceOnContract.deposited))
        .to.emit(contract, 'Withdraw')
        .withArgs(
          owner.address,
          RBTC_SENT.add(await ACC_INTEREST(blockOnDeposit))
        );

      balanceOnContract = await contract['getBalance()']();
      expect(balanceOnContract.deposited).to.be.equals(ethers.constants.Zero);
      expect(balanceOnContract.interest).to.be.equals(ethers.constants.Zero);
    });
  });

  describe('loans', () => {
    let acmeContract: ACME;
    let ERC20Mock: ERC677;
    let owner: SignerWithAddress;

    beforeEach(async () => {
      const { owner: contractOwner, contract } = await loadFixture(
        initialFixture
      );

      owner = contractOwner;

      acmeContract = contract;

      const ERC20MockFactory = (await ethers.getContractFactory(
        'ERC677'
      )) as ERC677__factory;

      // Emulates a pool of DOC for loans
      ERC20Mock = (await ERC20MockFactory.deploy(
        acmeContract.address,
        ethers.utils.parseEther('100000000000000'),
        'Dollar On Chain',
        'DOC'
      )) as ERC677;

      await ERC20Mock.deployed();

      await acmeContract.updateCollateralFactor(
        ERC20Mock.address,
        ethers.utils.parseEther('0.5')
      );

      const balance = await ERC20Mock.balanceOf(acmeContract.address);

      expect(+balance / 1e18).to.eq(100000000000000);
    });

    it('should not loan DOC if user does not have collateral deposited', async () => {
      expect(
        acmeContract['loan(address,uint256)'](ERC20Mock.address, '1')
      ).to.revertedWith('not enough collateral');
    });

    it('should not loan DOC if provider does not have enough ERC20 balance', async () => {
      const tx = await acmeContract['deposit()']({ value: RBTC_SENT });
      await tx.wait();

      expect(
        acmeContract['loan(address,uint256)'](ERC20Mock.address, '1')
      ).to.revertedWith('not enough balance');
    });

    it('should be able to loan DOC', async () => {
      expect(acmeContract['deposit()']({ value: RBTC_SENT }))
        .to.emit(acmeContract, 'Deposit')
        .withArgs(owner.address, RBTC_SENT);

      const [deposited] = await acmeContract['getBalance()']();

      expect(deposited).equal(RBTC_SENT.toString());

      const initialOwnerBalance = await ERC20Mock.balanceOf(owner.address);

      const tx = await acmeContract['loan(address,uint256)'](
        ERC20Mock.address,
        ethers.utils.parseEther('100')
      );

      await tx.wait();

      const finalOwnerBalance = await ERC20Mock.balanceOf(owner.address);

      expect(finalOwnerBalance.toString()).equal(
        initialOwnerBalance.add(ethers.utils.parseEther('100')).toString()
      );
    });

    it('should be able to repay doc debt', async () => {
      expect(acmeContract['deposit()']({ value: RBTC_SENT }))
        .to.emit(acmeContract, 'Deposit')
        .withArgs(owner.address, RBTC_SENT);

      const [deposited] = await acmeContract['getBalance()']();

      expect(deposited).equal(RBTC_SENT.toString());

      const initialOwnerBalance = await ERC20Mock.balanceOf(owner.address);

      const tx = await acmeContract['loan(address,uint256)'](
        ERC20Mock.address,
        ethers.utils.parseEther('100')
      );

      await tx.wait();

      const finalOwnerBalance = await ERC20Mock.balanceOf(owner.address);

      expect(finalOwnerBalance.toString()).equal(
        initialOwnerBalance.add(ethers.utils.parseEther('100')).toString()
      );

      const acmeBeforeDocBalance =
        +(await ERC20Mock.balanceOf(acmeContract.address)) / 1e18;

      const amountToBorrow = 100;

      const approveTx = await ERC20Mock.approve(
        acmeContract.address,
        ethers.utils.parseEther(amountToBorrow.toString())
      );

      await approveTx.wait();

      const tx2 = await acmeContract['repay(address,uint256,address)'](
        ERC20Mock.address,
        ethers.utils.parseEther(amountToBorrow.toString()),
        owner.address
      );

      await tx2.wait();

      const acmeAfterDocBalance =
        +(await ERC20Mock.balanceOf(acmeContract.address)) / 1e18;
      expect(acmeAfterDocBalance).to.eq(acmeBeforeDocBalance + 100);
    });
  });
});
