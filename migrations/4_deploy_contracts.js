const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const OrderUpgradeable = artifacts.require("OrderUpgradeable");

module.exports = async function(deployer, network) {
  if (network != 'test')  return;

  await deployProxy(OrderUpgradeable, [process.swapRouter.address], deployer);
};
