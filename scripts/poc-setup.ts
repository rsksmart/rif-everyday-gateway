import { ethers } from 'hardhat';
import { ACME, DummierLendingService } from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
const NATIVE_CURRENCY = ethers.constants.AddressZero;

type DeployResult = {
  acmeLending: ACME;
  lendingService: DummierLendingService;
};

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
    await deployContract<DummierLendingService>('DummierLendingService', {
      acmeLending: acmeLending.address,
    });

  return { acmeLending, lendingService: dummyLendingService };
}

async function setupLending() {
  //deploy providers contracts
  // add providers
  // deploy service provider contracts
  const { acmeLending, lendingService } = await deployDummyLendingService();
  const contractsJSON = {
    acmeLending: acmeLending.address,
    lendingService: lendingService.address,
  };

  await writeFileSync('contracts.json', JSON.stringify(contractsJSON, null, 2));

  lendingService.addListing(1, 1, NATIVE_CURRENCY, PaybackOption.Day, 1);
  lendingService.addListing(
    10,
    10,
    NATIVE_CURRENCY,
    PaybackOption.TwoWeeks,
    10
  );
  lendingService.addListing(
    100,
    100,
    NATIVE_CURRENCY,
    PaybackOption.Month,
    100
  );
  lendingService.addListing(
    1000,
    1000,
    NATIVE_CURRENCY,
    PaybackOption.Week,
    1000
  );
}

setupLending().then(() => console.log('done 👀'));
