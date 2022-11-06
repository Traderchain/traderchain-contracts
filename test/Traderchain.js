const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE, SWAP_ROUTER,
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');
  
describe("Traderchain", function () {  
  let signers;
  let trader;
  let investor1;
  
  let tc;
  let system;
  
  before(async () => {   
    await Util.resetForkState();
    signers = await ethers.getSigners();
    trader = signers[0];
    investor1 = signers[1];
          
    await Util.initContracts();
    tc = Util.tc;
    system = Util.system;
  });

  it("A trader can create a trading system including a vault", async function () {
    const systemId = await system.currentSystemId();
    Util.log({systemId});
    
    await tc.connect(trader).createTradingSystem();
    expect(await system.getSystemTrader(systemId)).to.equal(trader.address);
    
    const vault = await system.getSystemVault(systemId);
    Util.log({vault});
    expect(vault).not.to.equal(ADDRESS_ZERO);
    
    const vaultContract = await ethers.getContractAt("SystemVault", vault);
    const vaultTraderchain = await vaultContract.traderchain();
    const vaultTradingSystem = await vaultContract.tradingSystem();
    const vaultSystemId = await vaultContract.systemId();
    Util.log({vaultTraderchain, vaultTradingSystem, vaultSystemId});
    expect(vaultTraderchain).to.equal(tc.address);
    expect(vaultTradingSystem).to.equal(system.address);
    expect(vaultSystemId).to.equal(systemId);
    
    const DEFAULT_ADMIN_ROLE = await vaultContract.DEFAULT_ADMIN_ROLE();
    expect(await vaultContract.hasRole(DEFAULT_ADMIN_ROLE, system.address)).to.equal(true);
  });
  
  it("An investor can buy system shares", async function () {
    const systemId = 1;
    const vault = await system.getSystemVault(systemId);        
    const usdcAmount = Util.amountBN(100, 6);
    const sharePrice = await tc.getSystemSharePrice(systemId);
    const expectedShares = usdcAmount.div(sharePrice);
    Util.log({usdcAmount, sharePrice, expectedShares});
    
    await Util.usdcToken.connect(investor1).approve(tc.address, usdcAmount);
    
    const numberOfShares = await tc.connect(investor1).callStatic.buyShares(systemId, usdcAmount);
    await tc.connect(investor1).buyShares(systemId, usdcAmount);
    Util.log({numberOfShares});
    expect(numberOfShares).to.equal(expectedShares);
    
    const vaultBalance = await Util.usdcToken.balanceOf(vault);
    Util.log({vaultBalance});
    expect(vaultBalance).to.equal(usdcAmount);
    
    const systemFund = await tc.getSystemFund(systemId);
    Util.log({systemFund});
    expect(systemFund).to.equal(usdcAmount);
    
    const investorShares = await system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
    expect(investorShares).to.equal(numberOfShares);
  });
  
  it("A trader can place a buy order for his system", async function () {
    const systemId = 1;
    const usdcAmount = Util.amountBN(100, 6);
    const vault = await system.getSystemVault(systemId);
    Util.log({usdcAmount});
    
    let systemFund = await tc.getSystemFund(systemId); 
    let systemAsset = await tc.getSystemAsset(systemId);    
    Util.log({systemFund, systemAsset});
    
    await system.connect(trader).approveFunds(systemId, USDC, usdcAmount);
    
    const wethAmount = await tc.connect(trader).callStatic.placeBuyOrder(systemId, usdcAmount);
    Util.log({wethAmount});
    await tc.connect(trader).placeBuyOrder(systemId, usdcAmount);

    const wethPrice = Util.amountFloat(usdcAmount,6) / Util.amountFloat(wethAmount);
    Util.log({wethPrice});

    const newSystemFund = systemFund.sub(usdcAmount);
    const newSystemAsset = systemAsset.add(wethAmount);
    Util.log({newSystemFund, newSystemAsset});
        
    systemFund = await tc.getSystemFund(systemId); 
    systemAsset = await tc.getSystemAsset(systemId); 
    Util.log({systemFund, systemAsset});
    expect(systemFund).to.equal(newSystemFund);
    expect(systemAsset).to.equal(newSystemAsset);
    
    const vaultUsdcBalance = await Util.usdcToken.balanceOf(vault);
    const vaultWethBalance = await Util.wethToken.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});
    expect(vaultUsdcBalance).to.equal(newSystemFund);
    expect(vaultWethBalance).to.equal(newSystemAsset);
  });
  
});
