require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');

const secrets = require('./secrets_test.json');
const { privateKey, alchemyId, etherscanApiKey } = secrets;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
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
