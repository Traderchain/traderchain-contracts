import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import Util, { 
  ADDRESS_ZERO, USDC, WETH,
  BigNumber, formatUnits, formatEther  
} from '../lib/util';

describe("Traderchain", function () {  
  let signers: SignerWithAddress[];
  let trader: SignerWithAddress;
  let investor1: SignerWithAddress;
    
  /***
  * Shared functions
  */          
  async function placeOrder(systemId: number, tokenIn: string, tokenOut: string, amountIn: any) {    
    Util.log({systemId, tokenIn, tokenOut, amountIn});    
    const vault = await Util.system.getSystemVault(systemId);    
        
    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    let wethPrice = await Util.assetPrice(WETH);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), wethPrice});
    
    let systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    let systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemFund, systemAsset});
    
    const amountOut = await Util.tc.connect(trader).callStatic.placeOrder(systemId, tokenIn, tokenOut, amountIn);
    await Util.tc.connect(trader).placeOrder(systemId, tokenIn, tokenOut, amountIn);
    Util.log({amountOut});

    const expectedSystemFund = tokenIn == USDC ? systemFund.sub(amountIn) : systemFund.add(amountOut);
    const expectedSystemAsset = tokenIn == USDC ? systemAsset.add(amountOut) : systemAsset.sub(amountIn);
    Util.log({expectedSystemFund, expectedSystemAsset});
    
    const vaultUsdcBalance = await Util.usdc.balanceOf(vault);
    const vaultWethBalance = await Util.weth.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});
    expect(vaultUsdcBalance).to.equal(expectedSystemFund);
    expect(vaultWethBalance).to.equal(expectedSystemAsset);
    
    systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH); 
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
    await Util.initContracts();

    signers = await ethers.getSigners();
    trader = signers[0];
    investor1 = signers[1];
  });

  it("A trader can create a trading system including a vault", async function () {
    const systemId = await Util.system.currentSystemId();
    Util.log({systemId});
    
    await Util.tc.connect(trader).createTradingSystem(USDC);
    expect(await Util.system.getSystemTrader(systemId)).to.equal(trader.address);
    expect(await Util.system.getTraderSystemsCount(trader.address)).to.equal(1);
    expect(await Util.system.getTraderSystemByIndex(trader.address, 0)).to.equal(systemId);
    
    const vault = await Util.system.getSystemVault(systemId);
    Util.log({vault});
    expect(vault).not.to.equal(ADDRESS_ZERO);
    
    const vaultContract = await ethers.getContractAt("SystemVault", vault);
    const vaultTraderchain = await vaultContract.traderchain();
    const vaultTradingSystem = await vaultContract.tradingSystem();
    const vaultSystemId = await vaultContract.systemId();
    Util.log({vaultTraderchain, vaultTradingSystem, vaultSystemId});
    expect(vaultTraderchain).to.equal(Util.tc.address);
    expect(vaultTradingSystem).to.equal(Util.system.address);
    expect(vaultSystemId).to.equal(systemId);
    
    const DEFAULT_ADMIN_ROLE = await vaultContract.DEFAULT_ADMIN_ROLE();
    expect(await vaultContract.hasRole(DEFAULT_ADMIN_ROLE, Util.system.address)).to.equal(true);
  });
  
  it("An investor can buy system shares to initiate share issuance", async function () {
    const systemId = 1;
    const vault = await Util.system.getSystemVault(systemId);        
    const tokenIn = USDC;
    const usdcAmount = Util.amountBN(100, 6);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    const expectedShares = usdcAmount.div(sharePrice);
    Util.log({usdcAmount, sharePrice: Util.amountFloat(sharePrice,6), expectedShares});
    
    await Util.usdc.connect(investor1).approve(Util.tc.address, usdcAmount);
    
    const numberOfShares = await Util.tc.connect(investor1).callStatic.buyShares(systemId, tokenIn, usdcAmount);
    await Util.tc.connect(investor1).buyShares(systemId, tokenIn, usdcAmount);
    Util.log({numberOfShares});
    expect(numberOfShares).to.equal(expectedShares);
    
    const vaultBalance = await Util.usdc.balanceOf(vault);
    Util.log({vaultBalance});
    expect(vaultBalance).to.equal(usdcAmount);
    
    const systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC);
    Util.log({systemFund});
    expect(systemFund).to.equal(usdcAmount);
    
    const investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(numberOfShares);
  });
  
  it("A trader can place a buy order for his system", async function () {
    await placeBuyOrder();    
  });

  it("An investor can buy more system shares", async function () {    
    const systemId = 1;
    const tokenIn = USDC;
    const usdcAmount = Util.amountBN(100, 6);    
    const vault = await Util.system.getSystemVault(systemId);
    Util.log({systemId, usdcAmount});
    
    // Current values
    const wethPrice = await Util.assetPrice(WETH);    
    Util.log({wethPrice: Util.amountFloat(wethPrice,6)});
    
    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6)});
    
    let investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
  
    let vaultUsdcBalance = await Util.usdc.balanceOf(vault);
    let vaultWethBalance = await Util.weth.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});    
    
    let systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC);
    let systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH);
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
    await Util.usdc.connect(investor1).approve(Util.tc.address, usdcAmount);
  
    const numberOfShares = await Util.tc.connect(investor1).callStatic.buyShares(systemId, tokenIn, usdcAmount);
    await Util.tc.connect(investor1).buyShares(systemId, tokenIn, usdcAmount);
    Util.log({numberOfShares});
    expect(numberOfShares).to.equal(expectedShares);
  
    // Test expected values
    vaultUsdcBalance = await Util.usdc.balanceOf(vault);
    vaultWethBalance = await Util.weth.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});        
    expect(vaultUsdcBalance).to.equal(expectedFundAmount);
    expect(Util.amountFloat(vaultWethBalance,12).toFixed(0)).to.equal(Util.amountFloat(expectedAssetAmount,12).toFixed(0));
  
    systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC);
    systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH);
    Util.log({systemFund, systemAsset});    
    expect(systemFund).to.equal(vaultUsdcBalance);
    expect(systemAsset).to.equal(vaultWethBalance);
  
    investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(expectedInvestorShares);
    
    nav = await Util.tc.currentSystemNAV(systemId);
    sharePrice = await Util.tc.currentSystemSharePrice(systemId);
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
    let investorShares = await Util.tc.getInvestorShares(systemId, investor1.address);
    let investorFund = await Util.usdc.balanceOf(investor1.address);
    const numberOfShares = investorShares.div(BigNumber.from(2));
    const tokenOut = USDC;
    const vault = await Util.system.getSystemVault(systemId);    
    Util.log({systemId, investorShares, investorFund, numberOfShares});

    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    let wethPrice = await Util.assetPrice(WETH);
    let totalShares = await Util.tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), wethPrice, totalShares});

    let systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    let systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemFund, systemAsset});
    
    // Sell shares and receive funds
    const amountOut = await Util.tc.connect(investor1).callStatic.sellShares(systemId, numberOfShares, tokenOut);
    await Util.tc.connect(investor1).sellShares(systemId, numberOfShares, tokenOut);
    Util.log({amountOut});
                
    nav = await Util.tc.currentSystemNAV(systemId);
    sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    wethPrice = await Util.assetPrice(WETH);
    totalShares = await Util.tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), wethPrice, totalShares});

    systemFund = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    systemAsset = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemFund, systemAsset});
        
    investorShares = await Util.tc.getInvestorShares(systemId, investor1.address);
    investorFund = await Util.usdc.balanceOf(investor1.address);
    Util.log({investorShares, investorFund});
    
    // TODO: expect
  });
        
});
