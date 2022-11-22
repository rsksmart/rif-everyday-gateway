import {
  ACME,
  DummyBorrowService,
  ERC677,
  ERC677__factory,
} from 'typechain-types';
import { duration } from 'moment';
import { PaybackOption } from 'test/constants/service';
import { ethers, network } from 'hardhat';
import chalk from 'chalk';
import { oneRBTC } from 'test/utils/mock.utils';
import { deployContract } from 'utils/deployment.utils';
const NATIVE_CURRENCY = ethers.constants.AddressZero;
const rbtcPrice = 20000;

async function deployDoc(acme: ACME) {
  const ERC677Factory = (await ethers.getContractFactory(
    'ERC677'
  )) as ERC677__factory;

  const doc = (await ERC677Factory.deploy(
    acme.address,
    ethers.utils.parseEther('100000000000000'),
    'Dollar On Chain',
    'DOC'
  )) as ERC677;

  await doc.deployed();

  return { docContract: doc };
}

async function deployDummyBorrowingService() {
  const {
    contract: acme,
    signers: [owner],
  } = await deployContract<ACME>('ACME', {});

  // Add initial liquidity of 100 RBTC
  await owner.sendTransaction({
    to: acme.address,
    value: ethers.utils.parseEther('100'),
  });

  const { contract: dummyBorrowingService } =
    await deployContract<DummyBorrowService>('DummyBorrowService', {
      acme: acme.address,
    });

  return { acme, dummyBorrowingService };
}

const executeBorrowing = async () => {
  console.log(
    chalk.bold(chalk.cyan('          Executing Borrowing Operation🚀 '))
  );

  const { dummyBorrowingService, acme } = await deployDummyBorrowingService();

  const { docContract } = await deployDoc(acme);

  const [, borrower] = await ethers.getSigners();

  await acme.updateCollateralFactor(
    docContract.address,
    ethers.utils.parseEther('0.5') // 50%
  );

  const collateralFactor =
    +(await acme.getCetCollateralFactor(docContract.address)) / 1e18;

  const listingTx = await dummyBorrowingService.addListing({
    currency: docContract.address,
    interestRate: 5,
    loanToValue: ethers.utils.parseEther(collateralFactor.toString()),
    loanToValueCurrency: NATIVE_CURRENCY,
    maxAmount: ethers.utils.parseEther('10000'),
    minAmount: ethers.utils.parseEther('1'),
    maxDuration: 1000,
  });

  await listingTx.wait();

  const amountToBorrow = 10;
  const amountToLend = amountToBorrow / (rbtcPrice * collateralFactor);

  const initialOwnerBalance = await docContract.balanceOf(
    await borrower.getAddress()
  );

  console.log(
    chalk.green('borrower rBTC Balance on wallet before borrowing: '),
    +(await ethers.provider.getBalance(borrower.address)) / 1e18
  );

  console.log(
    chalk.green('borrower DoC Balance on wallet before borrowing: '),
    +initialOwnerBalance / 1e18
  );

  const borrowingServiceAsBorrower = dummyBorrowingService.connect(borrower);
  console.log(chalk.yellowBright('Borrowing...'));
  const tx = await borrowingServiceAsBorrower.borrow(
    ethers.utils.parseEther(amountToBorrow.toString()),
    docContract.address,
    0,
    10,
    { value: ethers.utils.parseEther(amountToLend.toString()) }
  );

  await tx.wait();

  const finalOwnerBalance = await docContract.balanceOf(
    await borrower.getAddress()
  );

  console.log(
    chalk.red('borrower rBTC Balance on wallet after borrowing: '),
    +(await ethers.provider.getBalance(borrower.address)) / 1e18
  );

  console.log(
    chalk.red('borrower DoC Balance on wallet after borrowing: '),
    +finalOwnerBalance / 1e18
  );

  console.log(chalk.magenta('Paying back...'));

  const docContractAsBorrower = docContract.connect(borrower);

  const approveTx = await docContractAsBorrower.approve(
    dummyBorrowingService.address,
    ethers.utils.parseEther(amountToBorrow.toString())
  );

  await approveTx.wait();

  const tx2 = await borrowingServiceAsBorrower.pay(
    ethers.utils.parseEther(amountToBorrow.toString()),
    docContract.address,
    0
  );

  tx2.wait();

  const afterPayOwnerBalance = await docContract.balanceOf(
    await borrower.getAddress()
  );

  console.log(
    chalk.blue('borrower rBTC Balance on wallet after paying back borrowing: '),
    +(await ethers.provider.getBalance(borrower.address)) / 1e18
  );

  console.log(
    chalk.blue('borrower DoC Balance on wallet paying back borrowing: '),
    +afterPayOwnerBalance / 1e18
  );
};

executeBorrowing().then(() => console.log('done 👀'));
