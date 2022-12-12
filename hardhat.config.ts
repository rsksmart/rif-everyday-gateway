import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-exposed';
import 'hardhat-gas-reporter';
import 'hardhat-packager';
import 'hardhat-watcher';
import { HardhatUserConfig } from 'hardhat/config';
import 'tsconfig-paths/register';
import 'solidity-coverage';

export default <HardhatUserConfig>{
  solidity: {
    compilers: [
      {
        version: '0.8.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 5000000000000000,
  },
  networks: {
    regtest: {
      url: 'http://localhost:4444',
    },
    ganache: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
      accounts: {
        mnemonic:
          'maximum curtain toward fox digital hair put warrior obey travel friend insect',
      },
    },
    testnet: {
      url: 'https://public-node.testnet.rsk.co',
      accounts: {
        mnemonic:
          'maximum curtain toward fox digital hair put warrior obey travel friend insect',
      },
      chainId: 31,
    },
  },
  typechain: {
    target: 'ethers-v5',
    outDir: 'typechain-types',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
  watcher: {
    compilation: {
      tasks: ['compile'],
      files: ['./contracts'],
      verbose: true,
    },
    tdd: {
      tasks: [
        // 'clean',
        // { command: 'compile', params: { quiet: true } },
        {
          command: 'test',
          params: {
            noCompile: true,
            testFiles: ['{path}'],
          },
        },
      ],
      files: ['./test/**/*.ts'],
      verbose: true,
    },
  },
  packager: {
    includeFactories: false,
    contracts: ['RIFGateway'],
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
  },
};
