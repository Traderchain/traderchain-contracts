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

  it("A trader can create a trading system", async function () {
    const systemId = await system.currentSystemId();
    
    await tc.connect(trader).mintTradingSystem();
    expect(await system.ownerOf(systemId)).to.equal(trader.address);
  });
  
  it("An investor can deposit funds to a system vault", async function () {
    const systemId = 1;
    const vault = await system.getSystemVault(systemId);        
    const usdcAmount = Util.amountBN(100, 6);
    
    await Util.usdcToken.connect(investor1).approve(tc.address, usdcAmount);
    await tc.connect(investor1).depositFunds(systemId, USDC, usdcAmount);
    
    let vaultBalance = await Util.usdcToken.balanceOf(vault);
    Util.log({vaultBalance});
    expect(vaultBalance).to.equal(usdcAmount);
    
    let systemFund = await tc.getSystemFund(systemId);
    Util.log({systemFund});
    expect(systemFund).to.equal(usdcAmount);
    
    let investorFund = await tc.getInvestorFund(systemId, investor1.address);
    Util.log({investorFund});
    expect(investorFund).to.equal(usdcAmount);
  });
  
  it("A trader can place a buy order for his system", async function () {
    const systemId = 1;
    const usdcAmount = Util.amountBN(100, 6);
    const vault = await system.getSystemVault(systemId);
    
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
