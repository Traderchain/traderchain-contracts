require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
  hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/Bcipbi3wYgtmrR-gkp6Fdc888i3N3ixG",
        blockNumber: 15812970,
      }
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
      },
    ],
  },  
};
