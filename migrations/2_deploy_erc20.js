const USDC = artifacts.require("USDC");
const WETH = artifacts.require("WETH");

module.exports = async function(deployer, network) {
  if (network != 'test')  return;

  await deployer.deploy(USDC);
  await deployer.deploy(WETH);  
};
