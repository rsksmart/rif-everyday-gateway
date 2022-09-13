import { ethers } from 'hardhat';
import {
  ACME,
  IdentityLendingService,
  Providers,
  UserIdentityFactory,
  FeeManager,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
const NATIVE_CURRENCY = ethers.constants.AddressZero;

async function deployDummyLendingService() {
  const feeBeneficiary = (await ethers.getSigners())[10];
  const { contract: feeManager } = await deployContract<FeeManager>(
    'FeeManager',
    {}
  );

  const { contract: identityFactory } =
    await deployContract<UserIdentityFactory>('UserIdentityFactory', {});

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
    await deployContract<IdentityLendingService>('IdentityLendingService', {
      acmeLending: acmeLending.address,
      identityFactory: identityFactory.address,
      feeManager: feeManager.address,
      feeBeneficiary: feeBeneficiary.address,
    });

  // Add initial fee support of 50 RBTC
  await owner.sendTransaction({
    to: dummyLendingService.address,
    value: ethers.utils.parseEther('50'),
  });

  return {
    feeManager,
    acmeLending,
    lendingService: dummyLendingService,
    identityFactory,
  };
}

async function deployProvidersContract() {
  const { contract: providersContract } = await deployContract<Providers>(
    'Providers',
    {}
  );

  return providersContract;
}

async function setupLending() {
  //deploy providers contracts

  // add providers
  // deploy service provider contracts
  const { feeManager, acmeLending, lendingService, identityFactory } =
    await deployDummyLendingService();

  const providersContract = await deployProvidersContract();

  const addServiceTx = await providersContract.addService(
    lendingService.address
  );
  await addServiceTx.wait();

  const validateTx = await providersContract.validate(
    true,
    lendingService.address
  );
  await validateTx.wait();

  const contractsJSON = {
    feeMananger: feeManager.address,
    acmeLending: acmeLending.address,
    lendingService: lendingService.address,
    providersContract: providersContract.address,
    identityFactory: identityFactory.address,
  };

  await writeFileSync('contracts.json', JSON.stringify(contractsJSON, null, 2));

  await (
    await lendingService.addListing(1, 1, NATIVE_CURRENCY, PaybackOption.Day, 1)
  ).wait();
  await (
    await lendingService.addListing(
      10,
      10,
      NATIVE_CURRENCY,
      PaybackOption.TwoWeeks,
      10
    )
  ).wait();
  await (
    await lendingService.addListing(
      100,
      100,
      NATIVE_CURRENCY,
      PaybackOption.Month,
      100
    )
  ).wait();
  await (
    await lendingService.addListing(
      1000,
      1000,
      NATIVE_CURRENCY,
      PaybackOption.Week,
      1000
    )
  ).wait();
}

setupLending().then(() => console.log('done 👀'));
