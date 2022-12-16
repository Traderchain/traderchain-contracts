import hre from "hardhat";
import { 
  ADDRESS_ZERO, SWAP_ROUTER, SWAP_FACTORY,
  BigNumber, formatUnits, formatEther,
  Util
} from '../lib/util';

const ethers = hre.ethers;

// npx hardhat run --network goerli scripts/deploy_traderchain.js
// npx hardhat verify --network goerli <TRADERCHAIN> <SWAP_ROUTER> <SWAP_FACTORY>
// npx hardhat verify --network goerli <TRADING_SYTEM> <TRADERCHAIN> "https://traderchain.org/system/"
// npx hardhat verify --network goerli <SYSTEM_VAULT> <TRADERCHAIN> <TRADING_SYTEM> <systemId>
async function main() {  
  const network = hre.network.name;
  console.log({ network });  

  const Traderchain = await ethers.getContractFactory("Traderchain");
  const tc = await Traderchain.deploy(SWAP_ROUTER, SWAP_FACTORY);
  Util.log({'tc': tc.address});
        
  const TradingSystem = await ethers.getContractFactory("TradingSystem");
  const system = await TradingSystem.deploy(tc.address, "https://traderchain.org/system/");
  Util.log({'system': system.address});
  
  await tc.setTradingSystem(system.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});