import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { deployRIFGateway } from 'test/services/utils';
import {
  IRIFGateway,
  NonUpgradableMock,
  UpgradableMock,
} from 'typechain-types';
import { deployContract } from 'utils/deployment.utils';
import { expect } from '../../chairc';

describe('RIF Gateway Universal Upgradable Proxy Standard', () => {
  let signers: SignerWithAddress[];
  let RIFGateway: IRIFGateway;

  const initialFixture = async () => {
    const signers = await ethers.getSigners();
    const gatewayContracts = await deployRIFGateway();

    return {
      signers,
      RIFGateway: gatewayContracts.RIFGateway,
    };
  };

  beforeEach(async () => {
    ({ signers, RIFGateway } = await loadFixture(initialFixture));
  });

  describe('Upgradability', () => {
    it('should update contracts logic', async () => {
      const { contract: logic } = await deployContract<UpgradableMock>(
        'UpgradableMock',
        {}
      );

      const upgradableRIFGateway = await ethers.getContractAt(
        'UUPSUpgradeable',
        RIFGateway.address
      );

      await (await upgradableRIFGateway.upgradeTo(logic.address)).wait();

      const updatedRIFGateway = await ethers.getContractAt(
        'UpgradableMock',
        RIFGateway.address
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
        RIFGateway.address
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
        RIFGateway.address,
        notOwner
      );

      await expect(
        upgradableRIFGateway.upgradeTo(nonUpgradableLogic.address)
      ).to.revertedWith('Ownable: caller is not the owner');
    });
  });
});
