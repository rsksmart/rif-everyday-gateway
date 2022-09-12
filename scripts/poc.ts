import { ethers } from 'hardhat';
import { ACME, DummyLendingService } from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';

type DeployResult = { acmeLending: ACME; lendingService: DummyLendingService };

async function deployDummyLendingService(): Promise<DeployResult> {
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

  return { acmeLending, lendingService: dummyLendingService };
}

async function executeLending() {
  const contracts = await deployDummyLendingService();
  const contractsJSON = {
    acmeLending: contracts.acmeLending.address,
    lendingService: contracts.lendingService.address,
  };

  await writeFileSync('contracts.json', JSON.stringify(contractsJSON, null, 2));
}

executeLending().then(() => console.log('done 👀'));
