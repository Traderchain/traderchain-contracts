const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const UniswapV3FactoryArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const SwapRouterArtifact = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
const NFTDescriptorArtifact = require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json");
const NonfungibleTokenPositionDescriptorArtifact = require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json");
const NonfungiblePositionManagerArtifact = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
  
const BigNumber = ethers.BigNumber;
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

describe("OrderUpgradeable", function () {
  let accounts;  
  let account0;
  let account1;
  
  let usdcToken;
  let wethToken;
  let uniswapV3Factory;
  let swapRouter;
  let nftDescriptor;
  let nonfungibleTokenPositionDescriptor;
  let nonfungiblePositionManager;
  let orderContract;

  function amountBN(amount, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  before(async () => {    
    accounts = await ethers.getSigners();
    account0 = accounts[0].address;
    account1 = accounts[1].address;
    
    const USDC = await ethers.getContractFactory("USDC");
    usdcToken = await USDC.deploy();
    
    const WETH = await ethers.getContractFactory("WETH");
    wethToken = await WETH.deploy();
    
    const UniswapV3Factory = await ethers.getContractFactoryFromArtifact(UniswapV3FactoryArtifact);
    uniswapV3Factory = await UniswapV3Factory.deploy();
    
    const SwapRouter = await ethers.getContractFactoryFromArtifact(SwapRouterArtifact);
    swapRouter = await SwapRouter.deploy(uniswapV3Factory.address, wethToken.address);
    
    const NFTDescriptor = await ethers.getContractFactoryFromArtifact(NFTDescriptorArtifact);
    nftDescriptor = await NFTDescriptor.deploy();    
  
    const NonfungibleTokenPositionDescriptor = await ethers.getContractFactoryFromArtifact(NonfungibleTokenPositionDescriptorArtifact, {libraries: {NFTDescriptor: nftDescriptor.address}});
    nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor.deploy(wethToken.address, ethers.utils.formatBytes32String("ETH"));
    
    const NonfungiblePositionManager = await ethers.getContractFactoryFromArtifact(NonfungiblePositionManagerArtifact);
    nonfungiblePositionManager = await NonfungiblePositionManager.deploy(uniswapV3Factory.address, wethToken.address, nonfungibleTokenPositionDescriptor.address);
    
    const OrderUpgradeable = await ethers.getContractFactory("OrderUpgradeable");
    orderContract = await upgrades.deployProxy(OrderUpgradeable, [swapRouter.address]);
  });

  it("Should test", async function () {
    let amountIn = amountBN(1);
    
    await usdcToken.mint(account0, amountIn);
    
    let balance0 = await usdcToken.balanceOf(account0);
    console.log(account0, balance0.toString());    
    expect(balance0).to.equal(amountIn);
    
    await usdcToken.approve(orderContract.address, amountIn);
    
    console.log(usdcToken.address, wethToken.address, amountIn.toString());
    let amountOut = await orderContract.swapExactInputSingle(usdcToken.address, wethToken.address, amountIn);
    
    balance0 = await usdcToken.balanceOf(account0);
    console.log(account0, balance0.toString());
    expect(balance0).to.equal(0);
  });  

});
