// import { config as _config } from 'dotenv';
// import HDWalletProvider from '@truffle/hdwallet-provider';

const DotENV = require('dotenv');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const dotConfig = DotENV.config();

const PROJECT_ID = dotConfig.parsed.PROJECT_ID || process.env.PROJECT_ID;
const ETHERSCAN_API_KEY = dotConfig.parsed.ETHERSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;

// const mnemonic = dotConfig.parsed.mnemonic || process.env.mnemonic;

const PRIVATE_KEY = dotConfig.parsed.PRIVATE_KEY || process.env.PRIVATE_KEY;

module.exports = {

  // https://infura.io/docs/ethereum#section/Choose-a-Network

  networks: {
    // development: {
    //   host: "127.0.0.1",
    //   port: 7545,
    //   network_id: "*"
    // },
    // test: {
    //   host: "127.0.0.1",
    //   port: 8545,
    //   network_id: "*"
    // },
    kovan: {
      network_id: 42,
      provider: () => new HDWalletProvider([PRIVATE_KEY], `https://kovan.infura.io/v3/${PROJECT_ID}`),
      // gas: 6721975,
      // gasPrice: 20000000000,
      confirmations: 6,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    mumbai: {
      network_id: 80001,
      provider: () => new HDWalletProvider([PRIVATE_KEY], `https://polygon-mumbai.infura.io/v3/${PROJECT_ID}`),
      // gas: 6721975,
      // gasPrice: 20000000000,
      confirmations: 6,
      timeoutBlocks: 200,
      skipDryRun: true
    },
    ethereum: {
      network_id: 1,
      provider: () => new HDWalletProvider([PRIVATE_KEY], `https://mainnet.infura.io/v3/${PROJECT_ID}`),
      // gas: 6721975,
      gasPrice: 150000000000,
      confirmations: 6
    },
    polygon: {
      network_id: 137,
      provider: () => new HDWalletProvider([PRIVATE_KEY], `https://polygon-mainnet.infura.io/v3/${PROJECT_ID}`),
      // gas: 6721975,
      gasPrice: 350000000000,
      confirmations: 6
    }
  },

  compilers: {
    solc: {
      version: '0.8.10',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

  api_keys: {
    // bscscan: BSCSCAN_API_KEY,
    etherscan: `${ETHERSCAN_API_KEY}`
  },

  plugins: [
    'solidity-coverage',
    'truffle-plugin-verify', // https://github.com/rkalis/truffle-plugin-verify/pull/104
    'truffle-contract-size'
  ]
};
