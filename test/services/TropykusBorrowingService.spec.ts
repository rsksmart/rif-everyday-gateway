import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ERC20,
  TropykusBorrowingService,
  TropykusBorrowingService__factory,
  UserIdentityFactory,
  UserIdentityFactory__factory,
} from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Tropykus Borrowing Service', () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let tropykusBorrowingService: TropykusBorrowingService;
  let userIdentity: UserIdentityFactory;
  let doc: ERC20;
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

  const onTestnet = hre.network.config.chainId === 31;
  console.log('onTestnet', onTestnet);

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    doc = (await ethers.getContractAt(
      'ERC20',
      onTestnet ? docAddressTestnet : docAddress,
      owner
    )) as ERC20;

    const userIdentityFactory = (await ethers.getContractFactory(
      'UserIdentityFactory'
    )) as UserIdentityFactory__factory;

    userIdentity = (await userIdentityFactory
      .connect(alice)
      .deploy()) as UserIdentityFactory;

    await userIdentity.deployed();

    const tropykusBorrowingServiceFactory = (await ethers.getContractFactory(
      'TropykusBorrowingService'
    )) as TropykusBorrowingService__factory;

    tropykusBorrowingService = (await tropykusBorrowingServiceFactory.deploy(
      userIdentity.address,
      onTestnet ? tropykusContractsTestnet : tropykusContracts
    )) as TropykusBorrowingService;

    await tropykusBorrowingService.deployed();

    await (
      await userIdentity
        .connect(alice)
        .authorize(tropykusBorrowingService.address, true)
    ).wait();

    await (
      await tropykusBorrowingService.connect(alice).createIdentity()
    ).wait();
  });

  it.skip('should allow to borrow DOC after lending RBTC on tropykus', async () => {
    const amountToBorrow = 2;

    const calculateAmountToLend = await tropykusBorrowingService
      .connect(alice)
      .calculateAmountToLend(
        ethers.utils.parseEther(amountToBorrow.toString())
      );
    const amountToLend = +calculateAmountToLend / 1e18;

    expect(amountToLend).to.equal(0.0007);

    const balanceUserBefore = await doc.balanceOf(alice.address);

    const tx = await tropykusBorrowingService.connect(alice).borrow(
      ethers.utils.parseEther(amountToBorrow.toString()),
      onTestnet ? docAddressTestnet : docAddress,
      0, // Not in use for now
      0, // Not in use for now
      { value: ethers.utils.parseEther(amountToLend.toString()) }
    );
    await tx.wait();

    const balanceTropAfter = await tropykusBorrowingService
      .connect(alice)
      .getLendBalance();

    expect(+balanceTropAfter / 1e18).to.equal(amountToLend);

    const balance = await doc.balanceOf(userIdentity.address);
    expect(+balance / 1e18).to.equal(0);

    const balanceUserAfter = await doc.balanceOf(alice.address);
    expect(+balanceUserAfter / 1e18).to.equal(
      +balanceUserBefore / 1e18 + amountToBorrow
    );
  });

  it.skip('should allow to repay DOC debt', async () => {
    const amountToBorrow = 5;

    const aliceIdentityAddress = await userIdentity.getIdentity(alice.address);
    const calculateAmountToLend = await tropykusBorrowingService
      .connect(alice)
      .calculateAmountToLend(
        ethers.utils.parseEther(amountToBorrow.toString())
      );
    const amountToLend = +calculateAmountToLend / 1e18;

    const docBalanceBefore = await doc.balanceOf(alice.address);

    const tx = await tropykusBorrowingService.connect(alice).borrow(
      ethers.utils.parseEther(amountToBorrow.toString()),
      onTestnet ? docAddressTestnet : docAddress,
      0, // Not in use for now
      0, // Not in use for now
      {
        value: ethers.utils.parseEther(amountToLend.toFixed(18)),
      }
    );
    await tx.wait();

    const docBalanceAfterBorrow = await doc.balanceOf(alice.address);

    const forInterest = 0.2;
    // Extra balance to pay interest $0.2

    await doc.transfer(
      alice.address,
      ethers.utils.parseEther(forInterest.toFixed(18))
    );
    const docBalanceAfterPlusCent = await doc.balanceOf(alice.address);

    const borrowBalance = await tropykusBorrowingService
      .connect(alice)
      .getBalance(doc.address);

    const borrowBalancePlusCent = ethers.utils.parseEther(
      (+borrowBalance / 1e18 + forInterest).toFixed(18)
    );
    const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterPlusCent)
      ? borrowBalancePlusCent
      : docBalanceAfterPlusCent;

    const approveTx = await doc
      .connect(alice)
      .approve(aliceIdentityAddress, approvedValue);
    await approveTx.wait();

    const payTx = await tropykusBorrowingService
      .connect(alice)
      .pay(approvedValue, onTestnet ? docAddressTestnet : docAddress, 0);
    await payTx.wait();

    const borrowBalanceAfter = await tropykusBorrowingService
      .connect(alice)
      .getBalance(doc.address);
    expect(+borrowBalanceAfter / 1e18).to.eq(0);

    const docBalanceAfter = await doc.balanceOf(alice.address);
    expect(+docBalanceAfter / 1e18).to.be.closeTo(
      +docBalanceAfterPlusCent / 1e18 - +borrowBalancePlusCent / 1e18,
      0.1
    );
  });

  it.skip('should allow withdraw collateral after repaying debt', async () => {
    const amountToBorrow = 5;

    const aliceIdentityAddress = await userIdentity.getIdentity(alice.address);
    const tropykusBorrowingServiceAsAlice =
      tropykusBorrowingService.connect(alice);
    const calculateAmountToLend =
      await tropykusBorrowingServiceAsAlice.calculateAmountToLend(
        ethers.utils.parseEther(amountToBorrow.toString())
      );
    const amountToLend = +calculateAmountToLend / 1e18;

    const docBalanceBefore = await doc.balanceOf(alice.address);

    const tx = await tropykusBorrowingServiceAsAlice.borrow(
      ethers.utils.parseEther(amountToBorrow.toString()),
      onTestnet ? docAddressTestnet : docAddress,
      0, // Not in use for now
      0, // Not in use for now
      {
        value: ethers.utils.parseEther(amountToLend.toFixed(18)),
      }
    );
    await tx.wait();

    const docBalanceAfterBorrow = await doc.balanceOf(alice.address);

    const forInterest = 0.2;
    // Extra balance to pay interest $0.2

    await doc.transfer(
      alice.address,
      ethers.utils.parseEther(forInterest.toFixed(18))
    );
    const docBalanceAfterPlusCent = await doc.balanceOf(alice.address);

    const borrowBalance = await tropykusBorrowingServiceAsAlice.getBalance(
      doc.address
    );

    const borrowBalancePlusCent = ethers.utils.parseEther(
      (+borrowBalance / 1e18 + forInterest).toFixed(18)
    );
    const approvedValue = borrowBalancePlusCent.lt(docBalanceAfterPlusCent)
      ? borrowBalancePlusCent
      : docBalanceAfterPlusCent;

    const approveTx = await doc
      .connect(alice)
      .approve(aliceIdentityAddress, approvedValue);
    await approveTx.wait();

    const payTx = await tropykusBorrowingServiceAsAlice.pay(
      approvedValue,
      onTestnet ? docAddressTestnet : docAddress,
      0
    );
    await payTx.wait();

    const borrowBalanceAfter = await tropykusBorrowingService
      .connect(alice)
      .getBalance(doc.address);

    const balanceTropBefore =
      await tropykusBorrowingServiceAsAlice.getLendBalance();
    expect(+balanceTropBefore / 1e18).to.equal(amountToLend);

    const withdrawTx = await tropykusBorrowingServiceAsAlice.withdraw();
    await withdrawTx.wait();

    const balanceTropAfter =
      await tropykusBorrowingServiceAsAlice.getLendBalance();
    expect(+balanceTropAfter / 1e18).to.equal(0);
  });
});