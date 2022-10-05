const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const BigNumber = ethers.BigNumber;

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

describe("OrderUpgradeable", function () {
  let accounts;  
  let account0;
  let account1;
  
  let usdcToken;
  let wethToken;
  let swapRouter;
  let orderContract;

  function amountBN(amount, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  before(async () => {    
    const USDC = await ethers.getContractFactory("USDC");
    const WETH = await ethers.getContractFactory("WETH");
    const OrderUpgradeable = await ethers.getContractFactory("OrderUpgradeable");
    
    accounts = await ethers.getSigners();
    account0 = accounts[0].address;
    account1 = accounts[1].address;
    
    usdcToken = await USDC.deploy();
    wethToken = await WETH.deploy();
    // swapRouter = process.swapRouter; // TODO: https://github.com/Uniswap/hardhat-v3-deploy/blob/382619a6c372f26c0478f17f665bb0b2521c9f5b/src/deployer/UniswapV3Deployer.ts#L133  
    orderContract = await upgrades.deployProxy(OrderUpgradeable, [ADDRESS_ZERO]); // TODO: [swapRouter.address]
  });

  it("Should test", async function () {
    let amountIn = amountBN(1);
    
    await usdcToken.mint(account0, amountIn);
    
    let balance0 = await usdcToken.balanceOf(account0);
    console.log(account0, balance0.toString());    
    expect(balance0).to.equal(amountIn);
  });  

});
