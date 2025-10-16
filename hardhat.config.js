// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: "https://rpc.hyperliquid.xyz/evm", // ← FIXED: rpc not api
        enabled: true
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    hyperevmTestnet: {
      url: "https://rpc.hyperliquid-testnet.xyz/evm", // ← Also fixed
      chainId: 998,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    hyperevm: {
      url: "https://rpc.hyperliquid.xyz/evm", // ← Fixed
      chainId: 999,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
