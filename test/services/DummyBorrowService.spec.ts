import { expect } from 'chairc';
import { constants, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import {
  ACME,
  ACME__factory,
  DummyBorrowService,
  DummyBorrowService__factory,
  ERC677,
  ERC677__factory,
} from 'typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { PaybackOption } from '../constants/service';

const NATIVE_CURRENCY = constants.AddressZero;

describe('BorrowService', () => {
  let owner: Signer;
  let borrowService: DummyBorrowService;
  let acme: ACME;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const acmeFactory = (await ethers.getContractFactory(
      'ACME'
    )) as ACME__factory;
    acme = await acmeFactory.deploy();
    await acme.deployed();

    const borrowServiceFactory = (await ethers.getContractFactory(
      'DummyBorrowService'
    )) as DummyBorrowService__factory;

    borrowService = (await borrowServiceFactory.deploy(
      acme.address
    )) as DummyBorrowService;

    await borrowService.deployed();
  });

  it('should deployed a Borrow Service', async () => {
    const deployed = await borrowService.deployed();

    expect(deployed.address).not.equal(constants.AddressZero);
  });
  it('should return borrow service listings current liquidity', async () => {
    const initialLiquidity = await borrowService.currentLiquidity(0);

    const listing = await borrowService.addListing({
      id: 0,
      minAmount: 1,
      maxAmount: 100,
      minDuration: 0,
      maxDuration: 1000,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'ACME Borrow Service',
    });

    await listing.wait();

    const resultLiquidity = await borrowService.currentLiquidity(0);

    expect(initialLiquidity).equal(0);
    expect(resultLiquidity).equal(100);
  });
  it('should add a new listing', async () => {
    const listing = await borrowService.addListing({
      id: 0,
      minAmount: 0,
      maxAmount: 100,
      minDuration: 0,
      maxDuration: 1000,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      currency: NATIVE_CURRENCY,
      payBackOption: PaybackOption.Day,
      enabled: true,
      name: 'ACME Borrow Service',
    });

    await listing.wait();

    const listingsCount = await borrowService.getListingsCount();

    expect(listingsCount).equal(1);
  });

  describe('Borrow Listings', () => {
    beforeEach(async () => {
      const listingTx = await borrowService.addListing({
        id: 0,
        minAmount: 1,
        maxAmount: 100,
        minDuration: 0,
        maxDuration: 1000,
        interestRate: 5,
        loanToValue: 10000,
        loanToValueTokenAddr: NATIVE_CURRENCY,
        currency: NATIVE_CURRENCY,
        payBackOption: PaybackOption.Day,
        enabled: true,
        name: 'ACME Borrow Service',
      });

      await listingTx.wait();
    });
    it('should add liquidity to the borrow service listing', async () => {
      const initialLiquidity = await borrowService.currentLiquidity(0);

      const liquidityTx = await borrowService.addLiquidity(100, 0);

      await liquidityTx.wait();

      const resultLiquidity = await borrowService.currentLiquidity(0);

      expect(initialLiquidity).equal(100);
      expect(resultLiquidity).equal(200);
    });
    it('should remove liquidity from the borrow service listing', async () => {
      const initialLiquidity = await borrowService.currentLiquidity(0);

      const liquidityTx = await borrowService.removeLiquidity(50, 0);

      await liquidityTx.wait();

      const resultLiquidity = await borrowService.currentLiquidity(0);

      expect(initialLiquidity).equal(100);
      expect(resultLiquidity).equal(50);
    });
    it('should disable a listing', async () => {
      const initialListingsCount = await borrowService.getListingsCount();

      const disableListingTx = await borrowService.disableListing(0);

      await disableListingTx.wait();

      const resultListingsCount = await borrowService.getListingsCount();

      expect(initialListingsCount).equal(1);
      expect(resultListingsCount).equal(1);

      const listing = await borrowService.getListing(0);
      expect(listing.enabled).equal(false);
    });
    it('should return a listing', async () => {
      const listing = await borrowService.getListing(0);

      expect(listing.id).equal(0);
      expect(listing.minAmount).equal(1);
      expect(listing.maxAmount).equal(100);
      expect(listing.minDuration).equal(0);
      expect(listing.maxDuration).equal(1000);
      expect(listing.interestRate).equal(5);
      expect(listing.loanToValue).equal(10000);
      expect(listing.loanToValueTokenAddr).equal(NATIVE_CURRENCY);
      expect(listing.currency).equal(NATIVE_CURRENCY);
      expect(listing.payBackOption).equal(PaybackOption.Day);
      expect(listing.enabled).equal(true);
      expect(listing.name).equal('ACME Borrow Service');
    });
  });

  describe('Borrow', () => {
    let doc: ERC677;
    let owner: SignerWithAddress;
    let collateralFactor: number;
    const rbtcPrice = 20000;

    beforeEach(async () => {
      [owner] = await ethers.getSigners();

      const ERC677Factory = (await ethers.getContractFactory(
        'ERC677'
      )) as ERC677__factory;

      doc = (await ERC677Factory.deploy(
        acme.address,
        ethers.utils.parseEther('100000000000000'),
        'Dollar On Chain',
        'DOC'
      )) as ERC677;

      await doc.deployed();

      await acme.updateCollateralFactor(
        doc.address,
        ethers.utils.parseEther('0.5') // 50%
      );

      collateralFactor =
        +(await acme.getCetCollateralFactor(doc.address)) / 1e18;

      const listingTx = await borrowService.addListing({
        id: 0,
        minAmount: ethers.utils.parseEther('1'),
        maxAmount: ethers.utils.parseEther('10000'),
        minDuration: 0,
        maxDuration: 1000,
        interestRate: 5,
        loanToValue: ethers.utils.parseEther(collateralFactor.toString()),
        loanToValueTokenAddr: NATIVE_CURRENCY,
        currency: doc.address,
        payBackOption: PaybackOption.Day,
        enabled: true,
        name: 'ACME Borrow Service',
      });

      await listingTx.wait();
    });

    it('should be able to borrow doc', async () => {
      const amountToBorrow = 10;
      const amountToLend = amountToBorrow / (rbtcPrice * collateralFactor);

      const initialOwnerBalance = await doc.balanceOf(await owner.getAddress());

      const tx = await borrowService.borrow(
        ethers.utils.parseEther(amountToBorrow.toString()),
        doc.address,
        0,
        10,
        { value: ethers.utils.parseEther(amountToLend.toString()) }
      );

      await tx.wait();

      const finalOwnerBalance = await doc.balanceOf(await owner.getAddress());

      expect(finalOwnerBalance.toString()).equal(
        initialOwnerBalance.add(ethers.utils.parseEther('10')).toString()
      );
    });

    it('should be able to repay doc debt', async () => {
      const amountToBorrow = 10;
      const amountToLend = amountToBorrow / (rbtcPrice * collateralFactor);

      const initialOwnerBalance = await doc.balanceOf(await owner.getAddress());

      const tx = await borrowService.borrow(
        ethers.utils.parseEther(amountToBorrow.toString()),
        doc.address,
        0,
        10,
        { value: ethers.utils.parseEther(amountToLend.toString()) }
      );

      await tx.wait();

      const finalOwnerBalance = await doc.balanceOf(await owner.getAddress());

      expect(finalOwnerBalance.toString()).equal(
        initialOwnerBalance.add(ethers.utils.parseEther('10')).toString()
      );

      const approveTx = await doc.approve(
        borrowService.address,
        ethers.utils.parseEther(amountToBorrow.toString())
      );

      await approveTx.wait();

      const tx2 = await borrowService.pay(
        ethers.utils.parseEther(amountToBorrow.toString()),
        doc.address,
        0
      );

      tx2.wait();

      const afterPayOwnerBalance = await doc.balanceOf(
        await owner.getAddress()
      );

      expect(afterPayOwnerBalance.toString())
        .equal(initialOwnerBalance)
        .toString();
    });

    it('should not be able borrow doc without enough collateral', async () => {
      const amountToBorrow = 100;
      const amountToLend = 0.0005; // 20000 * 0.0005 = 10

      const initialDocBalance = await doc.balanceOf(owner.address);

      await expect(
        borrowService.borrow(
          ethers.utils.parseEther(amountToBorrow.toString()),
          doc.address,
          0,
          10,
          { value: ethers.utils.parseEther(amountToLend.toFixed(18)) }
        )
      ).to.revertedWith(
        `NotEnoughCollateral(${ethers.utils.parseEther('0.0005')})`
      );

      const finalDocBalance = await doc.balanceOf(await owner.getAddress());

      expect(finalDocBalance.toString()).equal(initialDocBalance.toString());
    });
  });
});
