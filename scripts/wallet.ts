import {
  ACMELending__factory,
  DummyBorrowService,
  DummyLendingService,
  DummyLendingService__factory,
} from 'typechain-types';
import { deployContract, onlyDeployContract } from '../utils/deployment.utils';
import moment, { duration } from 'moment';
import { PaybackOption } from 'test/utils';
import { oneRBTC } from 'test/mock.utils';
import { ethers, network } from 'hardhat';
import chalk from 'chalk';
const rBTC = ethers.constants.AddressZero;

// const setupLendingProtocol = async () => {
//   // deploy the contract and get the deployed address
//   const contract = await onlyDeployContract<DummyLendingService>(
//     'DummyLendingService',
//     {}
//   );

//   const rewardRate = oneRBTC.mul(10); //10%

//   const listingTx = await contract.addListing(
//     duration(60, 'days').asMilliseconds(),
//     duration(3, 'years').asMilliseconds(),
//     rBTC, //for now 👀
//     PaybackOption.Month,
//     rewardRate
//   );

//   const txReceipt = await listingTx.wait();

//   const lendingServiceListingId = txReceipt.events?.find(
//     (e: any) => e.event === 'LendingServiceAdded'
//   )?.args?.lendingServiceId;

//   return {
//     lendingContract: contract,
//     lendingServiceListingId,
//   };
// };

// const setupBorrowingProtocol = async () => {
//   // deploy the contract and get the deployed address
//   const contract = await onlyDeployContract<DummyBorrowService>(
//     'DummyBorrowService',
//     {}
//   );

//   const listingTx = await contract.addListing({
//     currency: rBTC,
//     interestRate: 5,
//     loanToValue: 10000,
//     loanToValueTokenAddr: rBTC,
//     maxAmount: 100,
//     minAmount: 1,
//     maxDuration: 1000,
//   });

//   const txReceipt = await listingTx.wait();

//   const lendingServiceListingId = txReceipt.events?.find(
//     (e: any) => e.event === 'LendingServiceAdded'
//   )?.args?.lendingServiceId;

//   return {
//     lendingContract: contract,
//     lendingServiceListingId,
//   };
// };

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

  return { acmeLending, dummyLendingService };
}

const executeLending = async () => {
  console.log(
    chalk.bold(chalk.cyan('          Executing Lending Operation🚀 '))
  );

  const { dummyLendingService } = await deployDummyLendingServiceFixture();

  const [owner, lender] = await ethers.getSigners();

  const lendingContractAsLender = dummyLendingService.connect(lender);

  console.log(
    chalk.green('Lender Balance on wallet before lending: '),
    (await ethers.provider.getBalance(lender.address)).toString()
  );

  console.log(chalk.yellowBright('Lending...'));

  const loanTx = await lendingContractAsLender.lend(
    duration(3, 'months').asMilliseconds(),
    PaybackOption.Month,
    {
      value: oneRBTC.mul(10),
    }
  );

  await loanTx.wait();

  console.log(
    chalk.red('Lender Balance on wallet after lending: '),
    (await ethers.provider.getBalance(lender.address)).toString()
  );
  console.log(
    chalk.red('Lender Balance on lending contract after lending: '),
    (await lendingContractAsLender.getBalance()).toString()
  );

  //time manipulation...
  // Fast forward 100 blocks
  await network.provider.send('hardhat_mine', ['0x' + (100).toString(16)]);

  console.log(chalk.bgYellowBright('Fast forwarding 100 blocks'));

  const lenderCurrentBalance = await lendingContractAsLender.getBalance();
  console.log(
    chalk.blue('Lender Balance on lending contract after fast forward: '),
    lenderCurrentBalance.toString()
  );

  console.log(chalk.yellowBright('withdrawing funds...'));
  const withdrawTx = await lendingContractAsLender.withdraw();
  await withdrawTx.wait();

  console.log(
    chalk.magenta('Lender Balance on wallet after withdraw: '),
    (await ethers.provider.getBalance(lender.address)).toString()
  );
  console.log(
    chalk.magenta('Lender Balance on lending contract after withdraw: '),
    (await lendingContractAsLender.getBalance()).toString()
  );
};

// const executeBorrowing = async () => {
//   const { lendingContract, lendingServiceListingId } =
//     await setupLendingProtocol();

//   const [owner, lender, ...otherUsers] = await ethers.getSigners();

//   const lendingContractAsLender = lendingContract.connect(lender);

//   const loanTx = await lendingContractAsLender.lend(
//     oneRBTC.mul(10),
//     rBTC,
//     duration(3, 'months').asMilliseconds(),
//     PaybackOption.Month,
//     {
//       value: oneRBTC.mul(10),
//     }
//   );

//   await loanTx.wait();

//   console.log(
//     'Lender Balance on wallet',
//     await ethers.provider.getBalance(lender.address)
//   );
//   console.log(
//     'Lender Balance on lending contract',
//     await lendingContract.getBalance(lender.address)
//   );

//   //time manipulation...

//   const lenderCurrentBalance = await lendingContract.getBalance(lender.address);

//   const withdrawTx = await lendingContract.withdraw(lenderCurrentBalance, rBTC);
//   await withdrawTx.wait();

//   console.log(
//     'Lender Balance on wallet',
//     await ethers.provider.getBalance(lender.address)
//   );
//   console.log(
//     'Lender Balance on lending contract',
//     await lendingContract.getBalance(lender.address)
//   );
// };

executeLending().then(() => console.log('done 👀'));
