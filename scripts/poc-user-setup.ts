import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import {
  IdentityLendingService__factory,
  UserIdentityFactory__factory,
} from 'typechain-types';
import { readFileSync } from 'fs';
import { oneRBTC } from 'test/utils/mock.utils';

async function main() {
  const contractsFile = JSON.parse(
    await readFileSync('./contracts.json', 'utf8')
  );
  const [, user] = await ethers.getSigners();

  const identityFactory = new Contract(
    contractsFile.identityFactory,
    UserIdentityFactory__factory.abi,
    user
  );

  const authTx = await identityFactory.authorize(
    contractsFile.lendingService,
    true
  );

  await authTx.wait();

  const lendingService = new Contract(
    contractsFile.lendingService,
    IdentityLendingService__factory.abi,
    user
  );

  const loanTx = await lendingService.lend({
    value: oneRBTC.mul(10),
  });

  await loanTx.wait();

  const balance = await lendingService.getBalance();
  console.log(balance.toString());
}

main()
  .then(() => console.log('🫠'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
