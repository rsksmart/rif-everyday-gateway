import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ACME,
  DummierLendingService,
  UserIdentityFactory,
} from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Dummier Lending Service', () => {
  const initialFixture = async () => {
    const { contract: identityFactory, signers } =
      await deployContract<UserIdentityFactory>(
        'UserIdentityFactory',
        {},
        (await ethers.getContractFactory(
          'UserIdentityFactory',
          {}
        )) as Factory<UserIdentityFactory>
      );

    const { contract: acmeLendingService } = await deployContract<ACME>(
      'ACME',
      {},
      (await ethers.getContractFactory('ACME', {})) as Factory<ACME>
    );

    const { contract: DummierLendingService } =
      await deployContract<DummierLendingService>(
        'DummierLendingService',
        {
          acmeLending: acmeLendingService.address,
          userIdentityFactory: identityFactory.address,
        },
        (await ethers.getContractFactory(
          'DummierLendingService',
          {}
        )) as Factory<DummierLendingService>
      );

    const [owner, account1, account2, account3, ...accounts] = signers;

    await (
      await identityFactory.connect(account1).authorize(
        DummierLendingService.address, // user
        true
      )
    ).wait();

    // Add initial liquidity of 100 RBTC
    await owner.sendTransaction({
      to: acmeLendingService.address,
      value: ethers.utils.parseEther('100'),
    });

    return {
      identityFactory,
      DummierLendingService,
      owner,
      account1,
      account2,
      account3,
      accounts,
    };
  };

  describe('Lending and withdrawing', async () => {
    it('should allow account1 to lend', async () => {
      const { DummierLendingService, account1 } = await loadFixture(
        initialFixture
      );

      const RBTC_TO_LEND = ethers.utils.parseEther('5');

      // Lend using account1
      const DLSAsAccount1 = DummierLendingService.connect(account1);
      await expect(DLSAsAccount1.lend(100, 0, { value: RBTC_TO_LEND })).to
        .eventually.be.fulfilled;

      // Check balance for account1
      expect(await DLSAsAccount1.getBalance()).to.be.equals(RBTC_TO_LEND);
    });

    it('should allow account1 to withdraw after lending', async () => {
      const { DummierLendingService, account1 } = await loadFixture(
        initialFixture
      );

      const RBTC_TO_LEND = ethers.utils.parseEther('5');

      // Lend using account1
      const DLSAsAccount1 = DummierLendingService.connect(account1);
      expect(DLSAsAccount1.lend(100, 0, { value: RBTC_TO_LEND })).to.be
        .fulfilled;

      // Check balance for account1
      expect(await DLSAsAccount1.getBalance()).to.be.equals(RBTC_TO_LEND);

      // Withdraw from service provider
      await expect(DLSAsAccount1.withdraw()).to.eventually.be.fulfilled;

      // Check balance for account1
      expect(await DLSAsAccount1.getBalance()).to.be.equals(
        ethers.constants.Zero
      );
    });
  });
});
