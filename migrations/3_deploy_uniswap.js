const contract = require('@truffle/contract');

const WETH = artifacts.require("WETH");

const UniswapV3FactoryJson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const SwapRouterJson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');

const UniswapV3Factory = contract(UniswapV3FactoryJson);
const SwapRouter = contract(SwapRouterJson);

module.exports = async function(deployer, network, accounts) {
  if (network != 'test')  return;
  
  let wethToken = await WETH.deployed();
  
  let provider = network == 'ganache' ? new web3.providers.HttpProvider("http://localhost:7545") : web3.currentProvider;
  UniswapV3Factory.setProvider(provider);
  SwapRouter.setProvider(provider);    
  
  await deployer.deploy(UniswapV3Factory, {from: accounts[0]});
  process.uniswapV3Factory = await UniswapV3Factory.deployed();
  
  await deployer.deploy(SwapRouter, process.uniswapV3Factory.address, wethToken.address, {from: accounts[0]});
  process.swapRouter = await SwapRouter.deployed();
};
