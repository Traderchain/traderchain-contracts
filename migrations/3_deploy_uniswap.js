const contract = require('@truffle/contract');

const WETH = artifacts.require("WETH");

const UniswapV3FactoryJson = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const SwapRouterJson = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json');
const NFTDescriptorJson = require('@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json');
const NonfungibleTokenPositionDescriptorJson = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');

const UniswapV3Factory = contract(UniswapV3FactoryJson);
const SwapRouter = contract(SwapRouterJson);
const NFTDescriptor = contract(NFTDescriptorJson);
const NonfungibleTokenPositionDescriptor = contract(NonfungibleTokenPositionDescriptorJson);

module.exports = async function(deployer, network, accounts) {
  if (network != 'test')  return;
  
  let wethToken = await WETH.deployed();
  
  let provider = network == 'ganache' ? new web3.providers.HttpProvider("http://localhost:7545") : web3.currentProvider;
  UniswapV3Factory.setProvider(provider);
  SwapRouter.setProvider(provider);
  NFTDescriptor.setProvider(provider);
  NonfungibleTokenPositionDescriptor.setProvider(provider);
  
  await deployer.deploy(NFTDescriptor, {from: accounts[0]});
  process.nftDescriptor = await NFTDescriptor.deployed();  
  
  await NonfungibleTokenPositionDescriptor.detectNetwork();  
  await NonfungibleTokenPositionDescriptor.link(process.nftDescriptor);
  
  await deployer.deploy(NonfungibleTokenPositionDescriptor, wethToken.address, "ETH", {from: accounts[0]});  
  process.nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deployed();
  
  await deployer.deploy(UniswapV3Factory, {from: accounts[0]});
  process.uniswapV3Factory = await UniswapV3Factory.deployed();
  
  await deployer.deploy(SwapRouter, process.uniswapV3Factory.address, wethToken.address, {from: accounts[0]});
  process.swapRouter = await SwapRouter.deployed();
};
