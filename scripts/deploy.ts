import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { DummyBorrowService__factory } from 'typechain-types';

export const deployDummyBorrowService = async (
  owner: Signer,
  showLog: boolean = false
) => {
  const dummyBorrowServiceFactory = new DummyBorrowService__factory(owner);

  const dummyBorrowService = await dummyBorrowServiceFactory.deploy();

  await dummyBorrowService.deployed();

  if (showLog)
    console.log('Borrow service deployed to:', dummyBorrowService.address);

  return dummyBorrowService;
};

async function main() {
  const [owner] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', owner.address);

  console.log('Account balance:', (await owner.getBalance()).toString());

  await deployDummyBorrowService(owner, false);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
