const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const USDC = await ethers.getContractFactory("USDC");
  const WETH = await ethers.getContractFactory("WETH");
  
  const usdcToken = await USDC.deploy();
  const wethToken = await WETH.deploy();

  console.log(`Depployed USDC: ${usdcToken.address}`);
  console.log(`Depployed WETH: ${wethToken.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
