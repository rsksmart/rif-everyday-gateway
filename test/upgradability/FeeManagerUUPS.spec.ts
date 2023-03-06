import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { deployFeeManager, deployRIFGateway } from 'test/services/utils';
import {
  IFeeManager,
  NonUpgradableMock,
  UpgradableMock,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { expect } from '../../chairc';

describe('Fee Manager Universal Upgradable Proxy Standard', () => {
  let signers: SignerWithAddress[];
  let feeManager: IFeeManager;

  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const feeManager = await deployFeeManager();

    return {
      signers,
      feeManager,
    };
  };

  beforeEach(async () => {
    ({ signers, feeManager } = await loadFixture(initialFixture));
  });

  describe('Upgradability', () => {
    it('should update contracts logic', async () => {
      const { contract: logic } = await deployContract<UpgradableMock>(
        'UpgradableMock',
        {}
      );

      const upgradableRIFGateway = await ethers.getContractAt(
        'UUPSUpgradeable',
        feeManager.address
      );

      await (await upgradableRIFGateway.upgradeTo(logic.address)).wait();

      const updatedRIFGateway = await ethers.getContractAt(
        'UpgradableMock',
        feeManager.address
      );

      expect(await updatedRIFGateway.healthCheck()).to.be.equals(
        'UpgradableMock'
      );
    });

    it('should revert when update contract to a non unpgradable logic', async () => {
      const { contract: nonUpgradableLogic } =
        await deployContract<NonUpgradableMock>('NonUpgradableMock', {});

      const upgradableRIFGateway = await ethers.getContractAt(
        'UUPSUpgradeable',
        feeManager.address
      );

      await expect(upgradableRIFGateway.upgradeTo(nonUpgradableLogic.address))
        .to.reverted;
    });

    it('should revert if account is not authorized to upgrade contract', async () => {
      const notOwner = signers[1];
      const { contract: nonUpgradableLogic } =
        await deployContract<NonUpgradableMock>('NonUpgradableMock', {});

      const upgradableRIFGateway = await ethers.getContractAt(
        'UUPSUpgradeable',
        feeManager.address,
        notOwner
      );

      await expect(
        upgradableRIFGateway.upgradeTo(nonUpgradableLogic.address)
      ).to.revertedWith('Ownable: caller is not the owner');
    });
  });
});
