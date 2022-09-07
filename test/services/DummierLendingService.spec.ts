import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chairc';
import {
  ACMELending,
  DummierLendingService,
  UserIdentityFactory,
} from 'typechain-types';
import { deployContract, Factory } from 'utils/deployment.utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('User Identity', () => {
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

    const { contract: acmeLendingService } = await deployContract<ACMELending>(
      'ACMELending',
      {},
      (await ethers.getContractFactory(
        'ACMELending',
        {}
      )) as Factory<ACMELending>
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
      await identityFactory.allowLendingProvider(
        account1.address, // user
        DummierLendingService.address, // caller
        acmeLendingService.address // callee
      )
    ).wait();

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
      expect(DLSAsAccount1.lend(100, 0, { value: RBTC_TO_LEND })).to.be
        .fulfilled;

      // Check balance for account1
      expect(await DLSAsAccount1.getBalance()).to.be.equals(RBTC_TO_LEND);
    });
  });
});
