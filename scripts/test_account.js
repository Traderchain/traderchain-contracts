const hre = require("hardhat");
const ethers = hre.ethers;

const { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE, SWAP_ROUTER,
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');

async function main() {
  const signers = await ethers.getSigners();
  const trader = signers[0];
  const investor1 = signers[1];
  Util.log({trader: trader.address, investor1: investor1.address});
          
  await Util.initContracts();
  const tc = Util.tc;
  const system = Util.system;
  
  const TEST_ACCOUNT1 = '0xE68968Cac6a959F525d5166D0BF0c0881a2Ac0ca';
  
  const ethAmount = Util.amountBN(1);
  await Util.takeWhaleETH(TEST_ACCOUNT1, ethAmount);
  
  const usdcAmount = Util.amountBN(1000, 6);
  await Util.takeWhaleUSDC(TEST_ACCOUNT1, usdcAmount);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
