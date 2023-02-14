import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GatewayAccessControl } from '../../typechain-types';
import { expect } from '../../chairc';

const OWNER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('OWNER'));
const LOW_LEVEL_OPERATOR = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('LOW_LEVEL_OPERATOR')
);
const HIGH_LEVEL_OPERATOR = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('HIGH_LEVEL_OPERATOR')
);
const FINANCIAL_OWNER = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('FINANCIAL_OWNER')
);
const FINANCIAL_OPERATOR = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('FINANCIAL_OPERATOR')
);

describe('Gateway Access Control', () => {
  let gatewayAccessControl: GatewayAccessControl;
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  beforeEach(async () => {
    const gatewayAccessControlFactory = await ethers.getContractFactory(
      'GatewayAccessControl'
    );
    signers = await ethers.getSigners();
    [owner, alice, bob, charlie] = signers;
    gatewayAccessControl = (await gatewayAccessControlFactory
      .connect(owner)
      .deploy()) as GatewayAccessControl;
  });

  describe('Deployment', () => {
    it('should set deployer as owner', async () => {
      expect(await gatewayAccessControl.owner()).to.equal(owner.address);
    });
    it('should add OWNER role to deployer', async () => {
      expect(await gatewayAccessControl.isOwner(owner.address)).to.be.true;
    });
    it('should have OWNER as admin role of every other role', async () => {
      expect(await gatewayAccessControl.getRoleAdmin(OWNER)).to.equal(OWNER);
      expect(
        await gatewayAccessControl.getRoleAdmin(LOW_LEVEL_OPERATOR)
      ).to.equal(OWNER);
      expect(
        await gatewayAccessControl.getRoleAdmin(HIGH_LEVEL_OPERATOR)
      ).to.equal(OWNER);
      expect(await gatewayAccessControl.getRoleAdmin(FINANCIAL_OWNER)).to.equal(
        OWNER
      );
    });
    it('should have FINANCIAL_OWNER as admin role of FINANCIAL_OPERATOR', async () => {
      expect(
        await gatewayAccessControl.getRoleAdmin(FINANCIAL_OPERATOR)
      ).to.equal(FINANCIAL_OWNER);
    });
  });

  describe('Roles management', () => {
    it('should allow OWNER to change previous owner', async () => {
      await expect(
        gatewayAccessControl.connect(owner).changeOwner(alice.address)
      )
        .to.emit(gatewayAccessControl, 'RoleGranted')
        .withArgs(OWNER, alice.address, owner.address);

      expect(await gatewayAccessControl.isOwner(alice.address)).to.be.true;
      expect(await gatewayAccessControl.owner()).to.equal(alice.address);
      expect(await gatewayAccessControl.isOwner(owner.address)).to.be.false;
    });

    it('should not allow non-OWNER to change owner', async () => {
      await expect(gatewayAccessControl.connect(alice).changeOwner(bob.address))
        .to.be.eventually.rejected;
    });

    it('should allow OWNER to change previous owner', async () => {
      await expect(
        gatewayAccessControl.connect(owner).changeOwner(alice.address)
      )
        .to.emit(gatewayAccessControl, 'RoleGranted')
        .withArgs(OWNER, alice.address, owner.address);

      expect(await gatewayAccessControl.isOwner(alice.address)).to.be.true;
      expect(await gatewayAccessControl.owner()).to.equal(alice.address);
      expect(await gatewayAccessControl.isOwner(owner.address)).to.be.false;
    });

    it('should not allow non-OWNER to add a LOW_LEVEL_OPERATOR', async () => {
      await expect(
        gatewayAccessControl.connect(alice).addLowLevelOperator(bob.address)
      ).to.be.eventually.rejected;
    });

    it('should allow OWNER to add a LOW_LEVEL_OPERATOR', async () => {
      await (
        await gatewayAccessControl
          .connect(owner)
          .addLowLevelOperator(alice.address)
      ).wait();
      expect(await gatewayAccessControl.isLowLevelOperator(alice.address)).to.be
        .true;
    });

    it('should not allow non-OWNER to add a HIGH_LEVEL_OPERATOR', async () => {
      await expect(
        gatewayAccessControl.connect(alice).addHighLevelOperator(bob.address)
      ).to.be.eventually.rejected;
    });

    it('should allow OWNER to add a HIGH_LEVEL_OPERATOR', async () => {
      await (
        await gatewayAccessControl
          .connect(owner)
          .addHighLevelOperator(alice.address)
      ).wait();
      expect(await gatewayAccessControl.isHighLevelOperator(alice.address)).to
        .be.true;
    });

    it('should not allow non-OWNER to add a FINANCIAL_OWNER', async () => {
      await expect(
        gatewayAccessControl.connect(alice).addFinancialOwner(bob.address)
      ).to.be.eventually.rejected;
    });

    it('should allow OWNER to add a FINANCIAL_OWNER', async () => {
      await (
        await gatewayAccessControl
          .connect(owner)
          .addFinancialOwner(alice.address)
      ).wait();
      expect(await gatewayAccessControl.isFinancialOwner(alice.address)).to.be
        .true;
    });

    it('should not allow non-FINANCIAL_OWNER to add a FINANCIAL_OPERATOR', async () => {
      await expect(
        gatewayAccessControl.connect(owner).addFinancialOperator(bob.address)
      ).to.be.eventually.rejected;
    });

    it('should allow FINANCIAL_OWNER to add a FINANCIAL_OPERATOR', async () => {
      await (
        await gatewayAccessControl.connect(owner).addFinancialOwner(bob.address)
      ).wait();
      await (
        await gatewayAccessControl
          .connect(bob)
          .addFinancialOperator(alice.address)
      ).wait();
      expect(await gatewayAccessControl.isFinancialOperator(alice.address)).to
        .be.true;
    });
  });
});
