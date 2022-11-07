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
  
  it("An investor can buy system shares to initiate share issuance", async function () {
    const systemId = 1;
    const vault = await system.getSystemVault(systemId);        
    const usdcAmount = Util.amountBN(100, 6);
    const sharePrice = await tc.currentSystemSharePrice(systemId);
    const expectedShares = usdcAmount.div(sharePrice);
    Util.log({usdcAmount, sharePrice: Util.amountFloat(sharePrice,6), expectedShares});
    
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
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(numberOfShares);
  });
  
  it("A trader can place a buy order for his system", async function () {
    const systemId = 1;
    const usdcAmount = Util.amountBN(50, 6);
    const vault = await system.getSystemVault(systemId);
    Util.log({usdcAmount});
    
    let systemFund = await tc.getSystemFund(systemId); 
    let systemAsset = await tc.getSystemAsset(systemId);    
    Util.log({systemFund, systemAsset});
    
    await system.connect(trader).approveFunds(systemId, USDC, usdcAmount);
    
    const wethAmount = await tc.connect(trader).callStatic.placeBuyOrder(systemId, usdcAmount);
    Util.log({wethAmount});
    await tc.connect(trader).placeBuyOrder(systemId, usdcAmount);

    const wethPrice = Util.amountFloat(usdcAmount,6) * (1 - 0.003) / Util.amountFloat(wethAmount); // 0.3% pool fee
    Util.log({wethPrice});

    const expectedSystemFund = systemFund.sub(usdcAmount);
    const expectedSystemAsset = systemAsset.add(wethAmount);
    Util.log({expectedSystemFund, expectedSystemAsset});
        
    systemFund = await tc.getSystemFund(systemId); 
    systemAsset = await tc.getSystemAsset(systemId); 
    Util.log({systemFund, systemAsset});
    expect(systemFund).to.equal(expectedSystemFund);
    expect(systemAsset).to.equal(expectedSystemAsset);
    
    const vaultUsdcBalance = await Util.usdcToken.balanceOf(vault);
    const vaultWethBalance = await Util.wethToken.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});
    expect(vaultUsdcBalance).to.equal(expectedSystemFund);
    expect(vaultWethBalance).to.equal(expectedSystemAsset);
  });

  it("An investor can buy more system shares", async function () {    
    const systemId = 1;
    const usdcAmount = Util.amountBN(100, 6);    
    const vault = await system.getSystemVault(systemId);
    Util.log({systemId, usdcAmount});
    
    // Current values
    const wethPrice = await tc.getAssetPrice();    
    Util.log({wethPrice: Util.amountFloat(wethPrice,6)});
    
    let nav = await tc.currentSystemNAV(systemId);
    let sharePrice = await tc.currentSystemSharePrice(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6)});
    
    let investorShares = await system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
  
    let vaultUsdcBalance = await Util.usdcToken.balanceOf(vault);
    let vaultWethBalance = await Util.wethToken.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});    
    
    let systemFund = await tc.getSystemFund(systemId);
    let systemAsset = await tc.getSystemAsset(systemId);
    Util.log({systemFund, systemAsset});
    
    // Caculate asset allocation
    const BN6 = Util.amountBN(1,6);
    const BN0 = BigNumber.from(0);
    let fundAllocation = BN6;
    let assetAllocation = BN0;
    if (nav.gt(BN0)) {
      fundAllocation = BN6.mul(systemFund).div(nav);
      assetAllocation = BN6.sub(fundAllocation);
    }
    Util.log({fundAllocation: Util.amountFloat(fundAllocation,4), assetAllocation: Util.amountFloat(assetAllocation,4)});
    
    const assetAmount = assetAllocation.mul(usdcAmount).div(BN6);
    const fundAmount = usdcAmount.sub(assetAmount);
    const wethAmount = assetAmount.mul(BigNumber.from(997)).div(BigNumber.from(1000)).mul(BigNumber.from(10).pow(18)).div(wethPrice); // -0.3% pool fee   
    Util.log({assetAmount, fundAmount, wethAmount});
    
    // Expected values
    const expectedFundAmount = systemFund.add(fundAmount);
    const expectedAssetAmount = systemAsset.add(wethAmount);
    const expectedShares = usdcAmount.div(sharePrice);
    const expectedInvestorShares = investorShares.add(expectedShares);
    Util.log({expectedFundAmount, expectedAssetAmount, expectedShares, expectedInvestorShares});

    // Buy more shares
    await Util.usdcToken.connect(investor1).approve(tc.address, usdcAmount);
  
    const numberOfShares = await tc.connect(investor1).callStatic.buyShares(systemId, usdcAmount);
    await tc.connect(investor1).buyShares(systemId, usdcAmount);
    Util.log({numberOfShares});
    expect(numberOfShares).to.equal(expectedShares);
  
    // Test expected values
    vaultUsdcBalance = await Util.usdcToken.balanceOf(vault);
    vaultWethBalance = await Util.wethToken.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});        
    expect(vaultUsdcBalance).to.equal(expectedFundAmount);
    expect(Util.amountFloat(vaultWethBalance,11).toFixed(0)).to.equal(Util.amountFloat(expectedAssetAmount,11).toFixed(0));
  
    systemFund = await tc.getSystemFund(systemId);
    systemAsset = await tc.getSystemAsset(systemId);
    Util.log({systemFund, systemAsset});    
    expect(systemFund).to.equal(vaultUsdcBalance);
    expect(systemAsset).to.equal(vaultWethBalance);
  
    investorShares = await system.balanceOf(investor1.address, systemId);
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(expectedInvestorShares);
    
    nav = await tc.currentSystemNAV(systemId);
    sharePrice = await tc.currentSystemSharePrice(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6)});
  });
    
});
