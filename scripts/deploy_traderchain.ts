import hre from "hardhat";
import Util, { 
  ADDRESS_ZERO, INIT_SUPPORT_FUNDS, INIT_SUPPORT_ASSETS, SWAP_ROUTER, SWAP_FACTORY,
  BigNumber, formatUnits, formatEther  
} from '../lib/util';

const ethers = hre.ethers;

// npx hardhat run --network goerli scripts/deploy_traderchain.ts
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

  for (const fund of INIT_SUPPORT_FUNDS) { await tc.addSupportedFund(fund); }  
  for (const asset of INIT_SUPPORT_ASSETS) { await tc.addSupportedAsset(asset.assetAddress, asset.pools); }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
