import { expect } from 'chairc';
import { constants, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  ACME,
  ACME__factory,
  DummyBorrowService,
  DummyBorrowService__factory,
  ERC677,
  ERC677__factory,
} from 'typechain-types';

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
  it('should add a new listing', async () => {
    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const listingsCount = await borrowService.getListingsCount(NATIVE_CURRENCY);

    expect(listingsCount).equal(1);
  });
  it('should return borrow service listings current liquidity', async () => {
    const initialLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const resultLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    expect(initialLiquidity).equal(0);
    expect(resultLiquidity).equal(100);
  });
  it('should add liquidity to the borrow service listing', async () => {
    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const initialLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    const liquidityTx = await borrowService.addLiquidity(
      100,
      NATIVE_CURRENCY,
      0
    );

    await liquidityTx.wait();

    const resultLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    expect(initialLiquidity).equal(100);
    expect(resultLiquidity).equal(200);
  });
  it('should remove liquidity from the borrow service listing', async () => {
    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const initialLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    const liquidityTx = await borrowService.removeLiquidity(
      50,
      NATIVE_CURRENCY,
      0
    );

    await liquidityTx.wait();

    const resultLiquidity = await borrowService.currentLiquidity(
      NATIVE_CURRENCY,
      0
    );

    expect(initialLiquidity).equal(100);
    expect(resultLiquidity).equal(50);
  });
  it('should remove a listing', async () => {
    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const initialListingsCount = await borrowService.getListingsCount(
      NATIVE_CURRENCY
    );

    const removeListingTx = await borrowService.removeListing(
      0,
      NATIVE_CURRENCY
    );

    await removeListingTx.wait();

    const resultListingsCount = await borrowService.getListingsCount(
      NATIVE_CURRENCY
    );

    expect(initialListingsCount).equal(1);
    expect(resultListingsCount).equal(0);
  });
  it('should return a listing', async () => {
    const listing = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listing.wait();

    const initialListingsCount = await borrowService.getListingsCount(
      NATIVE_CURRENCY
    );

    const removeListingTx = await borrowService.removeListing(
      0,
      NATIVE_CURRENCY
    );

    await removeListingTx.wait();

    const resultListingsCount = await borrowService.getListingsCount(
      NATIVE_CURRENCY
    );

    expect(initialListingsCount).equal(1);
    expect(resultListingsCount).equal(0);
  });
  it('should return borrow service count of a given currency', async () => {
    const listingTx = await borrowService.addListing({
      currency: NATIVE_CURRENCY,
      interestRate: 5,
      loanToValue: 10000,
      loanToValueTokenAddr: NATIVE_CURRENCY,
      maxAmount: 100,
      minAmount: 1,
      maxDuration: 1000,
    });

    await listingTx.wait();

    const listing = await borrowService.getListing(0, NATIVE_CURRENCY);

    expect(listing.currency).equal(NATIVE_CURRENCY);
    expect(listing.interestRate).equal(5);
    expect(listing.loanToValue).equal(10000);
    expect(listing.loanToValueTokenAddr).equal(NATIVE_CURRENCY);
    expect(listing.maxAmount).equal(100);
    expect(listing.minAmount).equal(1);
    expect(listing.maxDuration).equal(1000);
  });

  describe('Borrow', () => {
    let doc: ERC677;
    beforeEach(async () => {
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
    });
  });
});