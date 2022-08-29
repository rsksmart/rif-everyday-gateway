import { LendingService } from 'typechain-types';
import { deployContract, onlyDeployContract } from '../utils/deployment.utils';
import moment, { duration } from 'moment';
import { PaybackOption } from 'test/utils';
import { oneRBTC } from 'test/mock.utils';
import { ethers } from 'hardhat';
const rBTC = ethers.constants.AddressZero;

// retrieve the services available listings

// execute lending

// Deployment Script Goes here

const setupMockTimeOracle = async () => {
  const { contract } = await deployContract('MockTimeOracle', {});

  const oracleTx = await contract.setTimeStamp(Date.now());
  const txReceipt = await oracleTx.wait();
  return {
    timeOracleContract: contract,
  };
};

const setupLendingProtocol = async () => {
  // deploy the contract and get the deployed address
  const contract = await onlyDeployContract<LendingService>(
    'LendingService',
    {}
  );

  const rewardRate = oneRBTC.mul(10); //10%

  const listingTx = await contract.addListing({
    minDuration: duration(60, 'days').asMilliseconds(),
    maxDuration: duration(3, 'years').asMilliseconds(),
    currency: rBTC, //for now 👀
    paybackOption: PaybackOption.Month,
    rewardRate: rewardRate,
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
  const { timeOracleContract } = await setupMockTimeOracle();

  const { lendingContract, lendingServiceListingId } =
    await setupLendingProtocol();

  const [owner, lender, ...otherUsers] = await ethers.getSigners();

  const lendingContractAsLender = lendingContract.connect(lender);

  const loanTx = await lendingContractAsLender.lend(
    oneRBTC.mul(10),
    rBTC,
    duration(3, 'months').asMilliseconds(),
    PaybackOption.Month,
    lendingServiceListingId,
    {
      value: oneRBTC.mul(10),
    }
  );

  const txReceipt = await loanTx.wait();

  console.log(
    'Lender Balance on wallet',
    await ethers.provider.getBalance(lender.address)
  );
  console.log(
    'Lender Balance on lending contract',
    await lendingContract.getBalance(lender.address)
  );

  //so in order for us to simulate time passing we need to get the time from an oracle. our own oracle. so besides the actual lending contract,
  // we need to deploy
  // an oracle that will return the current time. We'll make the lending protocol to depend on this oracle.
  // so when we execute lend it will have the current time, but before we
  // execute withdraw we will update the oracle time to reflect 3 months in the future or something. so the lending contract will allow it.

  const timeForwardingTx = timeOracleContract.setTimeStamp(
    moment().add(3, 'months').milliseconds()
  );
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
