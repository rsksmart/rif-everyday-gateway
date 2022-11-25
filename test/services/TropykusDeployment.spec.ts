import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chairc';
import { ethers } from 'hardhat';
import { tropykusFixture } from 'test/utils/tropykusFixture';

describe('Test tropykus deployment', async () => {
  it('should deploy tropykus contracts', async () => {
    const contracts = await loadFixture(tropykusFixture);

    expect(contracts.cdoc).to.be.not.equals(ethers.constants.AddressZero);
    expect(contracts.comptroller).to.be.not.equals(
      ethers.constants.AddressZero
    );
    expect(contracts.crbtc).to.be.not.equals(ethers.constants.AddressZero);
    expect(contracts.doc).to.be.not.equals(ethers.constants.AddressZero);
    expect(contracts.oracle).to.be.not.equals(ethers.constants.AddressZero);
  });
});
