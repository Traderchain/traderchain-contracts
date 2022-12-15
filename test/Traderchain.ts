import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE, SWAP_ROUTER,
  BigNumber, formatUnits, formatEther,
  Util
} from '../lib/util';

describe("Traderchain", function () {  
  let signers: SignerWithAddress[] = [];
  let trader: SignerWithAddress | { address: any; };
  let investor1: SignerWithAddress | { address: any; };
  
  let tc: any;
  let system: any;
  
  /***
  * Shared functions
  */          
  async function placeOrder(systemId: number, tokenIn: string, tokenOut: string, amountIn: any) {    
    Util.log({systemId, tokenIn, tokenOut, amountIn});    
    const vault = await system.getSystemVault(systemId);    
        
    let nav = await tc.currentSystemNAV(systemId);
    let sharePrice = await tc.currentSystemSharePrice(systemId);
    let assetPrice = await tc.getAssetPrice();
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), assetPrice});
    
    let systemFund = await tc.getSystemFund(systemId); 
    let systemAsset = await tc.getSystemAsset(systemId);    
    Util.log({systemFund, systemAsset});
    
    const amountOut = await tc.connect(trader).callStatic.placeOrder(systemId, tokenIn, tokenOut, amountIn);
    await tc.connect(trader).placeOrder(systemId, tokenIn, tokenOut, amountIn);
    Util.log({amountOut});

    const expectedSystemFund = tokenIn == USDC ? systemFund.sub(amountIn) : systemFund.add(amountOut);
    const expectedSystemAsset = tokenIn == USDC ? systemAsset.add(amountOut) : systemAsset.sub(amountIn);
    Util.log({expectedSystemFund, expectedSystemAsset});
    
    const vaultUsdcBalance = await Util.usdcToken.balanceOf(vault);
    const vaultWethBalance = await Util.wethToken.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});
    expect(vaultUsdcBalance).to.equal(expectedSystemFund);
    expect(vaultWethBalance).to.equal(expectedSystemAsset);
    
    systemFund = await tc.getSystemFund(systemId); 
    systemAsset = await tc.getSystemAsset(systemId); 
    Util.log({systemFund, systemAsset});
    expect(systemFund).to.equal(vaultUsdcBalance);
    expect(systemAsset).to.equal(vaultWethBalance);
  }
  
  async function placeBuyOrder() {
    const systemId = 1;
    const tokenIn = USDC;
    const tokenOut = WETH;
    const amountIn = Util.amountBN(50, 6); // 50 USDC    
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);    
  }
  
  async function placeSellOrder() {
    const systemId = 1;
    const tokenIn = WETH;
    const tokenOut = USDC;
    const amountIn = Util.amountBN(37, 15); // 0.037 WETH    
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);        
  }
  
  /***
  * Start testing
  */
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
    expect(await system.getTraderSystemsCount(trader.address)).to.equal(1);
    expect(await system.getTraderSystemByIndex(trader.address, 0)).to.equal(systemId);
    
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
    await placeBuyOrder();    
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

  it("A trader can place another buy order", async function () {
    await placeBuyOrder();    
  });
  
  it("A trader can place a sell order", async function () {
    await placeSellOrder();    
  });

  it("An investor can sell system shares and receive funds", async function () {
    const systemId = 1;
    let investorShares = await tc.getInvestorShares(systemId, investor1.address);
    let investorFund = await Util.usdcToken.balanceOf(investor1.address);
    const numberOfShares = investorShares.div(BigNumber.from(2));
    const vault = await system.getSystemVault(systemId);    
    Util.log({systemId, investorShares, investorFund, numberOfShares});

    let nav = await tc.currentSystemNAV(systemId);
    let sharePrice = await tc.currentSystemSharePrice(systemId);
    let assetPrice = await tc.getAssetPrice();
    let totalShares = await tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), assetPrice, totalShares});

    let systemFund = await tc.getSystemFund(systemId); 
    let systemAsset = await tc.getSystemAsset(systemId);    
    Util.log({systemFund, systemAsset});
    
    // Sell shares and receive funds
    const amountOut = await tc.connect(investor1).callStatic.sellShares(systemId, numberOfShares);
    await tc.connect(investor1).sellShares(systemId, numberOfShares);
    Util.log({amountOut});
                
    nav = await tc.currentSystemNAV(systemId);
    sharePrice = await tc.currentSystemSharePrice(systemId);
    assetPrice = await tc.getAssetPrice();
    totalShares = await tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), assetPrice, totalShares});

    systemFund = await tc.getSystemFund(systemId); 
    systemAsset = await tc.getSystemAsset(systemId);    
    Util.log({systemFund, systemAsset});
        
    investorShares = await tc.getInvestorShares(systemId, investor1.address);
    investorFund = await Util.usdcToken.balanceOf(investor1.address);
    Util.log({investorShares, investorFund});
    
    // TODO: expect
  });
        
});
