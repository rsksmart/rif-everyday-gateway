import { ethers } from 'hardhat';
import {
  ACME,
  IdentityLendingService,
  Providers,
  TropykusBorrowingService,
  UserIdentityFactory,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { writeFileSync } from 'fs';
import { PaybackOption } from 'test/constants/service';
const NATIVE_CURRENCY = ethers.constants.AddressZero;
const tropykusContracts = {
  comptroller: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
  oracle: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
  crbtc: '0x7bc06c482dead17c0e297afbc32f6e63d3846650',
  cdoc: '0x4a679253410272dd5232b3ff7cf5dbb88f295319',
};

async function deployIdentityFactory() {
  const { contract: identityFactory } =
    await deployContract<UserIdentityFactory>('UserIdentityFactory', {});

  return identityFactory;
}

async function deployBorrowingServices(identityFactory: UserIdentityFactory) {
  const { contract: tropykusBorrowingService } =
    await deployContract<TropykusBorrowingService>('TropykusBorrowingService', {
      identityFactory: identityFactory.address,
      tropykusContracts,
    });
  return { tropykusBorrowingService };
}

async function deployLendingServices(identityFactory: UserIdentityFactory) {
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
    });

  const { contract: tropykusLendingService } = await deployContract(
    'TropykusLendingService',
    {
      crbtc: '0x7bc06c482dead17c0e297afbc32f6e63d3846650',
      userIdentityFactory: identityFactory.address,
    }
  );

  return {
    acmeLending,
    lendingService: dummyLendingService,
    tropykusLendingService,
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
  const identityFactory = await deployIdentityFactory();
  //deploy providers contracts

  // add providers
  // deploy service provider contracts
  const { acmeLending, lendingService, tropykusLendingService } =
    await deployLendingServices(identityFactory);

  const { tropykusBorrowingService } = await deployBorrowingServices(
    identityFactory
  );

  const providersContract = await deployProvidersContract();

  console.log('lendingService', lendingService.address);
  console.log('tropykusLendingService', tropykusLendingService.address);
  console.log('tropykusBorrowingService', tropykusBorrowingService.address);

  const addServiceTx = await providersContract.addService(
    lendingService.address
  );
  await addServiceTx.wait();

  const addTropykusServiceTx = await providersContract.addService(
    tropykusLendingService.address
  );
  await addTropykusServiceTx.wait();

  const addTropykusBorrowingServiceTx = await providersContract.addService(
    tropykusBorrowingService.address
  );
  await addTropykusBorrowingServiceTx.wait();

  const validateTx = await providersContract.validate(
    true,
    lendingService.address
  );
  await validateTx.wait();

  const validateTropykusLendTx = await providersContract.validate(
    true,
    tropykusLendingService.address
  );
  await validateTropykusLendTx.wait();

  const validateTropykusBorrowTx = await providersContract.validate(
    true,
    tropykusBorrowingService.address
  );
  await validateTropykusBorrowTx.wait();

  const contractsJSON = {
    acmeLending: acmeLending.address,
    lendingService: lendingService.address,
    providersContract: providersContract.address,
    identityFactory: identityFactory.address,
    tropykusLendingService: tropykusLendingService.address,
    tropykusBorrowingService: tropykusBorrowingService.address,
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
  await (
    await tropykusLendingService.addListing(
      0,
      0,
      NATIVE_CURRENCY,
      PaybackOption.Day,
      5
    )
  ).wait();

  await (
    await tropykusBorrowingService.addListing({
      minAmount: 0,
      maxAmount: 0,
      maxDuration: 0,
      interestRate: ethers.utils.parseEther('0.5'),
      loanToValue: 0,
      loanToValueTokenAddr: ethers.constants.AddressZero,
      currency: ethers.constants.AddressZero,
    })
  ).wait();
}

setupLending().then(() => console.log('done 👀'));
