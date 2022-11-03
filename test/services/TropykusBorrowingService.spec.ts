import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ERC20,
  SmartWallet,
  SmartWalletFactory,
  TropykusBorrowingService,
  TropykusBorrowingService__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  externalSmartwalletFixture,
  smartwalletFactoryFixture,
} from '../smartwallet/fixtures';
import { signTransactionForExecutor } from '../smartwallet/utils';
import { Wallet } from 'ethers';
import { tropykusFixture } from 'test/utils/tropykusFixture';

describe('Tropykus Borrowing Service', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let tropykusBorrowingService: TropykusBorrowingService;
  let smartWalletFactory: SmartWalletFactory;
  let signers: SignerWithAddress[];
  let smartWallet: SmartWallet;
  let privateKey: string;
  let externalWallet: Wallet | SignerWithAddress;
  let doc: ERC20;
  let cdocAddress: string;
  const tropykusContracts = {
    comptroller: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
    oracle: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    crbtc: '0x7bc06c482dead17c0e297afbc32f6e63d3846650',
    cdoc: '0x4a679253410272dd5232b3ff7cf5dbb88f295319',
  };
  const tropykusContractsTestnet = {
    comptroller: '0xb1bec5376929b4e0235f1353819dba92c4b0c6bb',
    oracle: '0x9fbB872D3B45f95b4E3126BC767553D3Fa1e31C0',
    crbtc: '0x5b35072cd6110606c8421e013304110fa04a32a3',
    cdoc: '0x71e6b108d823c2786f8ef63a3e0589576b4f3914',
  };
  const docAddress = '0x59b670e9fa9d0a427751af201d676719a970857b';
  const docAddressTestnet = '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0';
  const localPrivateKeys = [
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ];
  const testnetPrivateKeys = [
    '0x9d9f047a66ce8e3c3df5c55fd4f7eb3d204989b34bdcf5cc16a9eeef937f8c31',
    '0x866edc99429101d2a2194702b82deeb59c4e29a37e0c2d704471d59b223c012b',
    '0xcc412ab8f588073e5cd58877e3fe8656f622f186b848f880095e938164ba79f1',
  ];

  const onTestnet = hre.network.config.chainId === 31;
  console.log('onTestnet', onTestnet);

  before(async () => {
    ({ smartWalletFactory, signers } = await smartwalletFactoryFixture());
  });

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const tropykusContractsDeployed = await tropykusFixture();
    cdocAddress = tropykusContractsDeployed.cdoc;

    doc = (await ethers.getContractAt(
      'ERC20',
      onTestnet ? docAddressTestnet : tropykusContractsDeployed.doc,
      owner
    )) as ERC20;

    ({ smartWallet, privateKey, externalWallet } =
      await externalSmartwalletFixture(
        smartWalletFactory,
        signers,
        onTestnet,
        onTestnet ? testnetPrivateKeys : localPrivateKeys
      ));

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory.deploy(
      smartWalletFactory.address,
      onTestnet ? tropykusContractsTestnet : tropykusContractsDeployed
    )) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();
  });

  it.only('should allow to borrow DOC after lending RBTC on tropykus', async () => {
    const amountToBorrow = 2;

    const calculateAmountToLend = await tropykusBorrowingService
      .connect(externalWallet)
      .calculateRequiredCollateral(
        ethers.utils.parseEther(amountToBorrow.toString()),
        ethers.constants.AddressZero
      );

    const amountToLend = +calculateAmountToLend / 1e18;

    expect(amountToLend).to.be.closeTo(0.0002, 0.0001);

    const balanceUserBefore = await doc.balanceOf(externalWallet.address);

    const { forwardRequest, suffixData, signature } =
      await signTransactionForExecutor(
        externalWallet.address,
        privateKey,
        tropykusBorrowingService.address,
        smartWalletFactory,
        hre.network.config.chainId
      );

    const tx = await tropykusBorrowingService.connect(externalWallet).borrow(
      suffixData,
      forwardRequest,
      signature,
      ethers.utils.parseEther(amountToBorrow.toString()),
      onTestnet ? docAddressTestnet : doc.address,
      0, // Not in use for now
      0, // Not in use for now
      { value: ethers.utils.parseEther(amountToLend.toString()) }
    );

    await tx.wait();

    const balanceTropAfter = await tropykusBorrowingService
      .connect(externalWallet)
      .getCollateralBalance();

    expect(+balanceTropAfter / 1e18).to.equal(amountToLend);

    const balance = await doc.balanceOf(smartWallet.address);

    expect(+balance / 1e18).to.equal(0);

    const balanceUserAfter = await doc.balanceOf(externalWallet.address);

    expect(+balanceUserAfter / 1e18).to.equal(
      +balanceUserBefore / 1e18 + amountToBorrow
    );
  });

  // it.skip('should allow to repay DOC debt', async () => {
  //   const amountToBorrow = 5;
  //
  //   const aliceIdentityAddress = await userIdentity.getIdentity(alice.address);
  //   const calculateAmountToLend = await tropykusBorrowingService
  //     .connect(alice)
  //     .calculateRequiredCollateral(
  //       ethers.utils.parseEther(amountToBorrow.toString()),
  //       ethers.constants.AddressZero
  //     );
  //   const amountToLend = +calculateAmountToLend / 1e18;
  //
  //   const docBalanceBefore = await doc.balanceOf(alice.address);
  //
  //   const tx = await tropykusBorrowingService.connect(alice).borrow(
  //     ethers.utils.parseEther(amountToBorrow.toString()),
  //     onTestnet ? docAddressTestnet : docAddress,
  //     0, // Not in use for now
  //     0, // Not in use for now
  //     {
  //       value: ethers.utils.parseEther(amountToLend.toFixed(18)),
  //     }
  //   );
  //   await tx.wait();
  //
  //   const docBalanceAfterBorrow = await doc.balanceOf(alice.address);
  //
  //   const forInterest = 0.2;
  //   // Extra balance to pay interest $0.2
  //
  //   await doc.transfer(
  //     alice.address,
  //     ethers.utils.parseEther(forInterest.toFixed(18))
  //   );
  //   const docBalanceAfterPlusCent = await doc.balanceOf(alice.address);
  //
  //   const borrowBalance = await tropykusBorrowingService
  //     .connect(alice)
  //     .getBalance(doc.address);
  //
  //   const borrowBalancePlusCent = ethers.utils.parseEther(
  //     (+borrowBalance / 1e18 + forInterest).toFixed(18)
  //   );
  //   const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterPlusCent)
  //     ? borrowBalancePlusCent
  //     : docBalanceAfterPlusCent;
  //
  //   const approveTx = await doc
  //     .connect(alice)
  //     .approve(aliceIdentityAddress, approvedValue);
  //   await approveTx.wait();
  //
  //   const payTx = await tropykusBorrowingService
  //     .connect(alice)
  //     .pay(approvedValue, onTestnet ? docAddressTestnet : docAddress, 0);
  //   await payTx.wait();
  //
  //   const borrowBalanceAfter = await tropykusBorrowingService
  //     .connect(alice)
  //     .getBalance(doc.address);
  //   expect(+borrowBalanceAfter / 1e18).to.eq(0);
  //
  //   const docBalanceAfter = await doc.balanceOf(alice.address);
  //   expect(+docBalanceAfter / 1e18).to.be.closeTo(
  //     +docBalanceAfterPlusCent / 1e18 - +borrowBalancePlusCent / 1e18,
  //     0.1
  //   );
  // });
  //
  // it.skip('should allow withdraw collateral after repaying debt', async () => {
  //   const amountToBorrow = 5;
  //
  //   const aliceIdentityAddress = await userIdentity.getIdentity(alice.address);
  //   const tropykusBorrowingServiceAsAlice =
  //     tropykusBorrowingService.connect(alice);
  //   const calculateAmountToLend =
  //     await tropykusBorrowingServiceAsAlice.calculateRequiredCollateral(
  //       ethers.utils.parseEther(amountToBorrow.toString()),
  //       ethers.constants.AddressZero
  //     );
  //   const amountToLend = +calculateAmountToLend / 1e18;
  //
  //   const docBalanceBefore = await doc.balanceOf(alice.address);
  //
  //   const tx = await tropykusBorrowingServiceAsAlice.borrow(
  //     ethers.utils.parseEther(amountToBorrow.toString()),
  //     onTestnet ? docAddressTestnet : docAddress,
  //     0, // Not in use for now
  //     0, // Not in use for now
  //     {
  //       value: ethers.utils.parseEther(amountToLend.toFixed(18)),
  //     }
  //   );
  //   await tx.wait();
  //
  //   const docBalanceAfterBorrow = await doc.balanceOf(alice.address);
  //
  //   const forInterest = 0.2;
  //   // Extra balance to pay interest $0.2
  //
  //   await doc.transfer(
  //     alice.address,
  //     ethers.utils.parseEther(forInterest.toFixed(18))
  //   );
  //   const docBalanceAfterPlusCent = await doc.balanceOf(alice.address);
  //
  //   const borrowBalance = await tropykusBorrowingServiceAsAlice.getBalance(
  //     doc.address
  //   );
  //
  //   const borrowBalancePlusCent = ethers.utils.parseEther(
  //     (+borrowBalance / 1e18 + forInterest).toFixed(18)
  //   );
  //   const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterPlusCent)
  //     ? borrowBalancePlusCent
  //     : docBalanceAfterPlusCent;
  //
  //   const approveTx = await doc
  //     .connect(alice)
  //     .approve(aliceIdentityAddress, approvedValue);
  //   await approveTx.wait();
  //
  //   const payTx = await tropykusBorrowingServiceAsAlice.pay(
  //     approvedValue,
  //     onTestnet ? docAddressTestnet : docAddress,
  //     0
  //   );
  //   await payTx.wait();
  //
  //   const borrowBalanceAfter = await tropykusBorrowingService
  //     .connect(alice)
  //     .getBalance(doc.address);
  //
  //   const balanceTropBefore =
  //     await tropykusBorrowingServiceAsAlice.getCollateralBalance();
  //   expect(+balanceTropBefore / 1e18).to.equal(amountToLend);
  //
  //   const withdrawTx = await tropykusBorrowingServiceAsAlice.withdraw();
  //   await withdrawTx.wait();
  //
  //   const balanceTropAfter =
  //     await tropykusBorrowingServiceAsAlice.getCollateralBalance();
  //   expect(+balanceTropAfter / 1e18).to.equal(0);
  // });
});
