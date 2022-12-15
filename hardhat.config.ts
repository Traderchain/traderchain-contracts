import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/config";

const secrets = require('./secrets_test.json');
const { privateKey, alchemyId, etherscanApiKey } = secrets;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyId}`,
        blockNumber: 15812970,
      }
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${alchemyId}`,
      accounts: [privateKey]
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,      
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,      
          },
        },
      },
    ],
  },  
  etherscan: {
    apiKey: etherscanApiKey,
  },
};

export default config;
