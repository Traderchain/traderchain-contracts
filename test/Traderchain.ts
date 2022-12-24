import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import Util, { 
  ADDRESS_ZERO, USDC, WETH,
  BigNumber, parseEther, formatUnits, formatEther  
} from '../lib/util';

const BN6 = Util.amountBN(1,6);
const BN18 = Util.amountBN(1,18);

describe("Traderchain", function () {  
  let signers: SignerWithAddress[];
  let trader: SignerWithAddress;
  let investor1: SignerWithAddress;
    
  /***
  * Shared functions
  */       
  async function checkVaultBalances(systemId: number) {
    const vault = await Util.system.getSystemVault(systemId);
    const systemAssets = [USDC, WETH];    

    for (const assetAddress of systemAssets) {
      const systemAssetAmount = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      const vaultAssetBalance = await Util.assetContract(assetAddress).balanceOf(vault);
      Util.log({assetAddress, systemAssetAmount, vaultAssetBalance});
      expect(vaultAssetBalance).to.equal(systemAssetAmount);
    }
  }

  async function buyShares(investor: SignerWithAddress, systemId: number, tokenIn: string, amountIn: BigNumberish) {    
    await Util.assetContract(tokenIn).connect(investor).approve(Util.tc.address, amountIn);
    
    const numberOfShares = await Util.tc.connect(investor).callStatic.buyShares(systemId, tokenIn, amountIn);
    await Util.tc.connect(investor).buyShares(systemId, tokenIn, amountIn);
    Util.log({numberOfShares});
    return numberOfShares;
  }

  async function placeOrder(systemId: number, tokenIn: string, tokenOut: string, amountIn: any) {    
    Util.log({systemId, tokenIn, tokenOut, amountIn});    
    const vault = await Util.system.getSystemVault(systemId);    
        
    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    let wethPrice = await Util.assetPrice(WETH);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), wethPrice});
    
    let systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    let systemWethAmount = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemUsdcAmount, systemWethAmount});
    
    const amountOut = await Util.tc.connect(trader).callStatic.placeOrder(systemId, tokenIn, tokenOut, amountIn);
    await Util.tc.connect(trader).placeOrder(systemId, tokenIn, tokenOut, amountIn);
    Util.log({amountOut});

    const expectedSystemUsdc = tokenIn == USDC ? systemUsdcAmount.sub(amountIn) : systemUsdcAmount.add(amountOut);
    const expectedSystemWeth = tokenIn == USDC ? systemWethAmount.add(amountOut) : systemWethAmount.sub(amountIn);
    Util.log({expectedSystemUsdc, expectedSystemWeth});
    
    const vaultUsdcBalance = await Util.usdc.balanceOf(vault);
    const vaultWethBalance = await Util.weth.balanceOf(vault);
    Util.log({vaultUsdcBalance, vaultWethBalance});
    expect(vaultUsdcBalance).to.equal(expectedSystemUsdc);
    expect(vaultWethBalance).to.equal(expectedSystemWeth);
    
    systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    systemWethAmount = await Util.tc.getSystemAssetAmount(systemId, WETH); 
    Util.log({systemUsdcAmount, systemWethAmount});
    expect(systemUsdcAmount).to.equal(vaultUsdcBalance);
    expect(systemWethAmount).to.equal(vaultWethBalance);
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
    const baseCurrency = USDC;
    Util.log({systemId, baseCurrency});
    
    await Util.tc.connect(trader).createTradingSystem(baseCurrency);
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
  
  it("An investor can buy system shares with USDC to initiate share issuance", async function () {
    const systemId = 1;
    const tokenIn = USDC;
    const amountIn = Util.amountBN(100, 6);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    const expectedShares = amountIn.div(sharePrice);
    Util.log({tokenIn, amountIn, sharePrice: Util.amountFloat(sharePrice,6), expectedShares});
    
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);
    expect(numberOfShares).to.equal(expectedShares);
        
    const systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);
    Util.log({systemUsdcAmount});
    expect(systemUsdcAmount).to.equal(amountIn);

    await checkVaultBalances(systemId);
    
    const investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(numberOfShares);
  });
  
  it("An investor can buy system shares with WETH", async function () {
    const systemId = 1;
    const tokenIn = WETH;    
    const amountIn = parseEther('0.037');
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);        
    Util.log({tokenIn, amountIn, sharePrice: Util.amountFloat(sharePrice,6)});

    let systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);    
    let investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({systemUsdcAmount, investorShares: investorShares.toString()});
    
    const tokenInPrice = await Util.assetPrice(tokenIn);
    const usdcAmount = Util.deductFee(amountIn.mul(tokenInPrice).div(BN18), 0.3); // -0.3% pool fee
    
    const expectedUsdcAmount = systemUsdcAmount.add(usdcAmount);
    const expectedShares = usdcAmount.div(sharePrice);
    const expectedInvestorShares = investorShares.add(expectedShares);
    Util.log({tokenInPrice, usdcAmount, systemUsdcAmount, expectedUsdcAmount, expectedShares, expectedInvestorShares});
    
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);
    expect(numberOfShares).to.equal(expectedShares);
        
    systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);    
    Util.log({systemUsdcAmount});
    Util.expectApprox(systemUsdcAmount, expectedUsdcAmount, 2);

    await checkVaultBalances(systemId);
    
    investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares: investorShares.toString()});
    expect(investorShares).to.equal(expectedInvestorShares);
  });

  it("A trader can place a buy order for his system", async function () {
    await placeBuyOrder();    
  });

  it("An investor can buy more system shares", async function () {        
    const systemId = 1;
    const tokenIn = USDC;
    const amountIn = Util.amountBN(100, 6);
    const vault = await Util.system.getSystemVault(systemId);
    const systemAssets = [USDC, WETH];
    Util.log({systemId, amountIn, systemAssets});
        
    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6)});
          
    // Calculate asset allocations
    const assetCount = await Util.tc.getSystemAssetCount(systemId);
    Util.log({assetCount});
    expect(assetCount).to.equal(systemAssets.length);
    
    const expectedAssetAmounts: any = {};
    for (const assetAddress of systemAssets) {
      const assetValue = await Util.tc.getSystemAssetValue(systemId, assetAddress);
      const assetAllocation = BN6.mul(assetValue).div(nav);
      const fundAmount = assetAllocation.mul(amountIn).div(BN6);
      Util.log({assetAddress, assetValue, assetAllocation: Util.amountFloat(assetAllocation,4), fundAmount});
      if (fundAmount.isZero())  continue;

      expectedAssetAmounts[assetAddress] = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      if (assetAddress == tokenIn) {
        expectedAssetAmounts[assetAddress] = expectedAssetAmounts[assetAddress].add(fundAmount);
      }
      else {          
        const assetPrice = await Util.assetPrice(assetAddress);        
        const assetAmount = Util.deductFee(fundAmount.mul(BN18).div(assetPrice), 0.3); // -0.3% pool fee
        Util.log({assetPrice, assetAmount});
        expectedAssetAmounts[assetAddress] = expectedAssetAmounts[assetAddress].add(assetAmount);
      }
    }
    Util.log({expectedAssetAmounts});    

    let investorShares = await Util.system.balanceOf(investor1.address, systemId);
    const expectedShares = Util.deductFee(amountIn.div(sharePrice), 0.3/3); // -0.3% * 1/3 pool fee
    const expectedInvestorShares = investorShares.add(expectedShares);
    Util.log({expectedShares, expectedInvestorShares});

    // Buy more shares
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);
    expect(numberOfShares).to.equal(expectedShares);
  
    // Test expected values
    for (const assetAddress of systemAssets) {
      const systemAssetAmount = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      Util.log({assetAddress, systemAssetAmount});
      if (systemAssetAmount.gt(Util.amountBN(1,12))) {
        const systemAssetAmountFloat = Util.amountFloat(systemAssetAmount,12).toFixed(0);
        Util.log({systemAssetAmountFloat});
        expect(systemAssetAmountFloat).to.equal(Util.amountFloat(expectedAssetAmounts[assetAddress],12).toFixed(0));
      }
      else {
        expect(systemAssetAmount).to.equal(expectedAssetAmounts[assetAddress]);
      }
    }

    await checkVaultBalances(systemId);
  
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

    let systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    let systemWethAmount = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemUsdcAmount, systemWethAmount});
    
    // Sell shares and receive funds
    const amountOut = await Util.tc.connect(investor1).callStatic.sellShares(systemId, numberOfShares, tokenOut);
    await Util.tc.connect(investor1).sellShares(systemId, numberOfShares, tokenOut);
    Util.log({amountOut});
                
    nav = await Util.tc.currentSystemNAV(systemId);
    sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    wethPrice = await Util.assetPrice(WETH);
    totalShares = await Util.tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), wethPrice, totalShares});

    systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC); 
    systemWethAmount = await Util.tc.getSystemAssetAmount(systemId, WETH);    
    Util.log({systemUsdcAmount, systemWethAmount});
        
    investorShares = await Util.tc.getInvestorShares(systemId, investor1.address);
    investorFund = await Util.usdc.balanceOf(investor1.address);
    Util.log({investorShares, investorFund});
    
    // TODO: expect
  });
        
});
