import '@nomiclabs/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
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
  networks: {
    regtest: {
      url: 'http://localhost:4444',
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
