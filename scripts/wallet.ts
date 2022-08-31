import { DummyBorrowService, DummyLendingService } from 'typechain-types';
import { deployContract, onlyDeployContract } from '../utils/deployment.utils';
import moment, { duration } from 'moment';
import { PaybackOption } from 'test/utils';
import { oneRBTC } from 'test/mock.utils';
import { ethers } from 'hardhat';
const rBTC = ethers.constants.AddressZero;

// retrieve the services available listings

// execute lending

// Deployment Script Goes here

const setupLendingProtocol = async () => {
  // deploy the contract and get the deployed address
  const contract = await onlyDeployContract<DummyLendingService>(
    'DummyLendingService',
    {}
  );

  const rewardRate = oneRBTC.mul(10); //10%

  const listingTx = await contract.addListing(
    duration(60, 'days').asMilliseconds(),
    duration(3, 'years').asMilliseconds(),
    rBTC, //for now 👀
    PaybackOption.Month,
    rewardRate
  );

  const txReceipt = await listingTx.wait();

  const lendingServiceListingId = txReceipt.events?.find(
    (e: any) => e.event === 'LendingServiceAdded'
  )?.args?.lendingServiceId;

  return {
    lendingContract: contract,
    lendingServiceListingId,
  };
};

const setupBorrowingProtocol = async () => {
  // deploy the contract and get the deployed address
  const contract = await onlyDeployContract<DummyBorrowService>(
    'DummyBorrowService',
    {}
  );

  const listingTx = await contract.addListing({
    currency: rBTC,
    interestRate: 5,
    loanToValue: 10000,
    loanToValueTokenAddr: rBTC,
    maxAmount: 100,
    minAmount: 1,
    maxDuration: 1000,
  });

  const txReceipt = await listingTx.wait();

  const lendingServiceListingId = txReceipt.events?.find(
    (e: any) => e.event === 'LendingServiceAdded'
  )?.args?.lendingServiceId;

  return {
    lendingContract: contract,
    lendingServiceListingId,
  };
};

const executeLending = async () => {
  const { lendingContract, lendingServiceListingId } =
    await setupLendingProtocol();

  const [owner, lender, ...otherUsers] = await ethers.getSigners();

  const lendingContractAsLender = lendingContract.connect(lender);

  const loanTx = await lendingContractAsLender.lend(
    oneRBTC.mul(10),
    rBTC,
    duration(3, 'months').asMilliseconds(),
    PaybackOption.Month,
    {
      value: oneRBTC.mul(10),
    }
  );

  await loanTx.wait();

  console.log(
    'Lender Balance on wallet',
    await ethers.provider.getBalance(lender.address)
  );
  console.log(
    'Lender Balance on lending contract',
    await lendingContract.getBalance(lender.address)
  );

  //time manipulation...

  const lenderCurrentBalance = await lendingContract.getBalance(lender.address);

  const withdrawTx = await lendingContract.withdraw(lenderCurrentBalance, rBTC);
  await withdrawTx.wait();

  console.log(
    'Lender Balance on wallet',
    await ethers.provider.getBalance(lender.address)
  );
  console.log(
    'Lender Balance on lending contract',
    await lendingContract.getBalance(lender.address)
  );
};

const executeBorrowing = async () => {
  const { lendingContract, lendingServiceListingId } =
    await setupLendingProtocol();

  const [owner, lender, ...otherUsers] = await ethers.getSigners();

  const lendingContractAsLender = lendingContract.connect(lender);

  const loanTx = await lendingContractAsLender.lend(
    oneRBTC.mul(10),
    rBTC,
    duration(3, 'months').asMilliseconds(),
    PaybackOption.Month,
    {
      value: oneRBTC.mul(10),
    }
  );

  await loanTx.wait();

  console.log(
    'Lender Balance on wallet',
    await ethers.provider.getBalance(lender.address)
  );
  console.log(
    'Lender Balance on lending contract',
    await lendingContract.getBalance(lender.address)
  );

  //time manipulation...

  const lenderCurrentBalance = await lendingContract.getBalance(lender.address);

  const withdrawTx = await lendingContract.withdraw(lenderCurrentBalance, rBTC);
  await withdrawTx.wait();

  console.log(
    'Lender Balance on wallet',
    await ethers.provider.getBalance(lender.address)
  );
  console.log(
    'Lender Balance on lending contract',
    await lendingContract.getBalance(lender.address)
  );
};

executeLending().then(() => console.log('done 👀'));
