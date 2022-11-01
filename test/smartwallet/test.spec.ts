import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chairc';
import { tropykusFixture } from 'test/utils/tropykusFixture';

describe('Test tropykus deployment', () => {
  it('should deploy tropykus contracts', async () => {
    const contracts = await loadFixture(tropykusFixture);

    console.log(contracts);
  });
});
