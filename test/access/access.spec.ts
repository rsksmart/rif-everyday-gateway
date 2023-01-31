import { ethers } from 'hardhat';
import { deployContract, Factory } from 'utils/deployment.utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GatewayAccessControl } from '../../typechain-types';
import { expect } from '../../chairc';

describe.only('Gateway Access Control', () => {
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
    gatewayAccessControl =
      (await gatewayAccessControlFactory.deploy()) as GatewayAccessControl;
    signers = await ethers.getSigners();
    [owner, alice, bob, charlie] = signers;
  });

  describe('Deployment', () => {
    it('should set deployer as owner', async () => {
      expect(await gatewayAccessControl.owner()).to.equal(owner.address);
    });
    it('should add OWNER role to deployer', async () => {
      expect(await gatewayAccessControl.isOwner(owner.address)).to.be.true;
    });
  });

  describe('OWNER', () => {
    it('should allow OWNER to change previous owner', async () => {
      await expect(
        gatewayAccessControl.connect(owner).changeOwner(alice.address)
      ).to.be.eventually.fulfilled;

      expect(await gatewayAccessControl.isOwner(alice.address)).to.be.true;
      expect(await gatewayAccessControl.owner()).to.equal(alice.address);
      expect(await gatewayAccessControl.isOwner(owner.address)).to.be.false;
    });

    it('should not allow non-OWNER to change owner', async () => {
      await expect(gatewayAccessControl.connect(alice).changeOwner(bob.address))
        .to.be.eventually.rejected;
    });
  });
});
