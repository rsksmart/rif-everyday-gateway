import { ACME, DummyLendingService } from 'typechain-types';
import { duration } from 'moment';
import { PaybackOption } from 'test/constants/service';
import { ethers, network } from 'hardhat';
import chalk from 'chalk';
import { oneRBTC } from 'test/utils/mock.utils';
import { deployContract } from 'utils/deployment.utils';
const rBTC = ethers.constants.AddressZero;

async function deployDummyLendingServiceFixture() {
  const {
    contract: acmeLending,
    signers: [owner],
  } = await deployContract<ACME>('ACME', {});

  // Add initial liquidity of 100 RBTC
  await owner.sendTransaction({
    to: acmeLending.address,
    value: ethers.utils.parseEther('100'),
  });

  const { contract: dummyLendingService } =
    await deployContract<DummyLendingService>('DummyLendingService', {
      acmeLending: acmeLending.address,
    });

  return { acmeLending, dummyLendingService };
}

const executeLending = async () => {
  console.log(
    chalk.bold(chalk.cyan('          Executing Lending Operation🚀 '))
  );

  const { dummyLendingService } = await deployDummyLendingServiceFixture();

  const [, lender] = await ethers.getSigners();

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

executeLending().then(() => console.log('done 👀'));
