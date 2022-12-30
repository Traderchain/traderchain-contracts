import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import Util, { 
  ADDRESS_ZERO, USDC, WETH, UNI,
  BigNumber, parseEther, formatUnits, formatEther,
  BN0, BN6, BN18, 
} from '../lib/util';

describe("Traderchain", function () {  
  let signers: SignerWithAddress[];
  let trader: SignerWithAddress;
  let investor1: SignerWithAddress;
  let systemAssets: string[] = [];

  /***
  * Shared functions
  */       
  function addSystemAsset(assetAddress: string) {
    if (!systemAssets.includes(assetAddress))  systemAssets.push(assetAddress);
  }

  async function checkVaultBalances(systemId: number) {
    console.log(`\t=== checkVaultBalances()`);    
    const vault = await Util.system.getSystemVault(systemId);
    
    for (const assetAddress of systemAssets) {
      const systemAssetAmount = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      const vaultAssetBalance = await Util.assetContract(assetAddress).balanceOf(vault);
      const systemAssetValue = await Util.tc.getSystemAssetValue(systemId, assetAddress);
      Util.log({assetAddress, systemAssetAmount, vaultAssetBalance, systemAssetValue});
      expect(vaultAssetBalance).to.equal(systemAssetAmount);
    }
  }

  async function checkAssetAmounts(systemId: number, expectedAssetAmounts: any) {    
    console.log(`\t=== checkAssetAmounts()`);
    for (const assetAddress in expectedAssetAmounts) {
      const systemAssetAmount = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      const expectedAssetAmount = expectedAssetAmounts[assetAddress];
      Util.log({assetAddress, systemAssetAmount, expectedAssetAmount});
      if (systemAssetAmount.gt(Util.amountBN(1,12))) {
        Util.expectApprox(systemAssetAmount, expectedAssetAmount, 12);
      }
      else {
        expect(systemAssetAmount).to.equal(expectedAssetAmount);
      }
    }
  }

  async function buyShares(investor: SignerWithAddress, systemId: number, tokenIn: string, amountIn: BigNumberish) {    
    console.log(`\t=== buyShares()`);
    await Util.assetContract(tokenIn).connect(investor).approve(Util.tc.address, amountIn);
    
    const numberOfShares = await Util.tc.connect(investor).callStatic.buyShares(systemId, tokenIn, amountIn);
    await Util.tc.connect(investor).buyShares(systemId, tokenIn, amountIn);
    Util.log({numberOfShares});
    return numberOfShares;
  }

  async function sellShares(investor: SignerWithAddress, systemId: number, numberOfShares: BigNumberish, tokenOut: string) {
    console.log(`\t=== sellShares()`);
    const amountOut = await Util.tc.connect(investor).callStatic.sellShares(systemId, numberOfShares, tokenOut);
    await Util.tc.connect(investor1).sellShares(systemId, numberOfShares, tokenOut);
    Util.log({amountOut});
    return amountOut;
  }
  
  async function testSellShares(investor: SignerWithAddress, systemId: number, tokenOut: string) {
    console.log(`\t=== testSellShares()`);    
    const approxDecimals = tokenOut == USDC ? 5 : 15;

    let nav = await Util.tc.currentSystemNAV(systemId);
    let sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    let totalShares = await Util.tc.totalSystemShares(systemId);
    Util.log({systemId, tokenOut, nav, sharePrice: Util.amountFloat(sharePrice,6), totalShares});

    let investorShares = await Util.tc.getInvestorShares(systemId, investor.address);
    const numberOfShares = investorShares.div(BigNumber.from(2));    
    const expectedInvestorShares = investorShares.sub(numberOfShares);    
    const expectTotalShares = totalShares.sub(numberOfShares);
    Util.log({investorShares, numberOfShares, expectedInvestorShares, expectTotalShares});
    
    // Calculate asset allocations to liquidate
    const assetCount = await Util.tc.getSystemAssetCount(systemId);
    Util.log({assetCount, systemAssets});
    expect(assetCount).to.equal(systemAssets.length);
    
    let expectedAmountOut = BN0;
    let expectedAssetAmounts: any = {};
    for (const assetAddress of systemAssets) {
      const systemAssetAmount = await Util.tc.getSystemAssetAmount(systemId, assetAddress);
      expectedAssetAmounts[assetAddress] = systemAssetAmount;

      const assetAmount = systemAssetAmount.mul(numberOfShares).div(totalShares);
      Util.log({assetAddress, assetAmount});
      if (assetAmount.isZero())  continue;

      expectedAssetAmounts[assetAddress] = expectedAssetAmounts[assetAddress].sub(assetAmount);      
      if (assetAddress == tokenOut) {
        expectedAmountOut = expectedAmountOut.add(assetAmount);        
        continue;
      }

      const assetPrice = await Util.assetPrice(assetAddress, tokenOut);
      const poolFee = await Util.poolFee(assetAddress, tokenOut);
      const assetOutAmount = Util.deductFee(assetAmount.mul(assetPrice).div(BN18), poolFee);
      Util.log({assetPrice, poolFee, assetOutAmount});
      expectedAmountOut = expectedAmountOut.add(assetOutAmount);      
    }
    Util.log({expectedAmountOut, expectedAssetAmounts});

    let investorTokenOutAmount = await Util.assetContract(tokenOut).balanceOf(investor.address);
    const expectedInvestorTokenOutAmount = investorTokenOutAmount.add(expectedAmountOut);
    Util.log({investorTokenOutAmount, expectedInvestorTokenOutAmount});

    // Sell shares
    const amountOut = await sellShares(investor, systemId, numberOfShares, tokenOut);
    Util.expectApprox(amountOut, expectedAmountOut, approxDecimals);
                
    // Expect values
    investorShares = await Util.tc.getInvestorShares(systemId, investor.address);
    investorTokenOutAmount = await Util.assetContract(tokenOut).balanceOf(investor.address);
    Util.log({investorShares, investorTokenOutAmount});
    expect(investorShares).to.equal(expectedInvestorShares);
    Util.expectApprox(investorTokenOutAmount, expectedInvestorTokenOutAmount, approxDecimals);

    nav = await Util.tc.currentSystemNAV(systemId);
    sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    totalShares = await Util.tc.totalSystemShares(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6), totalShares});
    expect(totalShares).to.equal(expectTotalShares);

    await checkAssetAmounts(systemId, expectedAssetAmounts);
    await checkVaultBalances(systemId);
  }
  
  async function placeOrder(systemId: number, tokenIn: string, tokenOut: string, amountIn: any) {    
    console.log(`\t=== placeOrder()`);
    Util.log({systemId, tokenIn, tokenOut, amountIn});

    addSystemAsset(tokenOut);
        
    const nav = await Util.tc.currentSystemNAV(systemId);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    Util.log({nav, sharePrice: Util.amountFloat(sharePrice,6)});
    
    let tokenInAmount = await Util.tc.getSystemAssetAmount(systemId, tokenIn);
    let tokenOutAmount = await Util.tc.getSystemAssetAmount(systemId, tokenOut);
    Util.log({tokenInAmount, tokenOutAmount});
    
    // Place a swap order
    const amountOut = await Util.tc.connect(trader).callStatic.placeOrder(systemId, tokenIn, tokenOut, amountIn);
    await Util.tc.connect(trader).placeOrder(systemId, tokenIn, tokenOut, amountIn);
    Util.log({amountOut});

    const expectedTokenInAmount = tokenInAmount.sub(amountIn);
    const expectedTokenOutAmount = tokenOutAmount.add(amountOut);
    Util.log({expectedTokenInAmount, expectedTokenOutAmount});
        
    tokenInAmount = await Util.tc.getSystemAssetAmount(systemId, tokenIn);
    tokenOutAmount = await Util.tc.getSystemAssetAmount(systemId, tokenOut);
    Util.log({tokenInAmount, tokenOutAmount});
    expect(tokenInAmount).to.equal(expectedTokenInAmount);
    expect(tokenOutAmount).to.equal(expectedTokenOutAmount);

    await checkVaultBalances(systemId);
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
  });
  
  it("An investor can buy system shares with USDC to initiate share issuance", async function () {
    const systemId = 1;
    const tokenIn = USDC;
    const amountIn = Util.amountBN(1000, 6);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    const expectedShares = amountIn.div(sharePrice);
    Util.log({tokenIn, amountIn, sharePrice: Util.amountFloat(sharePrice,6), expectedShares});
    
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);
    expect(numberOfShares).to.equal(expectedShares);
        
    const systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);
    Util.log({systemUsdcAmount});
    expect(systemUsdcAmount).to.equal(amountIn);
    
    const investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
    expect(investorShares).to.equal(numberOfShares);
    
    addSystemAsset(tokenIn);
    await checkVaultBalances(systemId);
  });
  
  it("An investor can buy system shares with WETH", async function () {
    const systemId = 1;
    const tokenIn = WETH;    
    const amountIn = parseEther('0.75');
    Util.log({systemId, tokenIn, amountIn});

    const baseCurrency = await Util.tc.getSystemBaseCurrency(systemId);
    const nav = await Util.tc.currentSystemNAV(systemId);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);            
    Util.log({baseCurrency, nav, sharePrice: Util.amountFloat(sharePrice,6)});

    let systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);    
    let investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({systemUsdcAmount, investorShares});
    
    const tokenInPrice = await Util.assetPrice(tokenIn);
    const poolFee = await Util.poolFee(tokenIn, USDC);
    const assetValue = await Util.tc.getAssetValue(baseCurrency, tokenIn, amountIn);
    const usdcAmount = Util.deductFee(assetValue, poolFee);
    const expectedNAV = nav.add(usdcAmount);
    const expectedUsdcAmount = systemUsdcAmount.add(usdcAmount);
    Util.log({tokenInPrice, poolFee, assetValue, usdcAmount, expectedNAV, expectedUsdcAmount});
    
    // Buy system shares
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);    

    const newNAV = await Util.tc.currentSystemNAV(systemId);
    Util.log({newNAV});
    Util.expectApprox(newNAV, expectedNAV, 4);

    const expectedShares = newNAV.sub(nav).div(sharePrice);
    const expectedInvestorShares = investorShares.add(expectedShares);
    Util.log({expectedShares, expectedInvestorShares});
    expect(numberOfShares).to.equal(expectedShares);
    
    investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
    expect(investorShares).to.equal(expectedInvestorShares);

    systemUsdcAmount = await Util.tc.getSystemAssetAmount(systemId, USDC);    
    Util.log({systemUsdcAmount});
    Util.expectApprox(systemUsdcAmount, expectedUsdcAmount, 4);

    addSystemAsset(tokenIn);
    await checkVaultBalances(systemId);
  });

  it("A trader can swap USDC for WETH for his own system", async function () {
    const systemId = 1;
    const tokenIn = USDC;
    const tokenOut = WETH;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);    
  });

  it("An investor can buy more system shares with USDC", async function () {        
    const systemId = 1;
    const tokenIn = USDC;
    const amountIn = Util.amountBN(1000, 6);
    Util.log({systemId, amountIn});
        
    const baseCurrency = await Util.tc.getSystemBaseCurrency(systemId);
    const nav = await Util.tc.currentSystemNAV(systemId);
    const sharePrice = await Util.tc.currentSystemSharePrice(systemId);
    Util.log({baseCurrency, nav, sharePrice: Util.amountFloat(sharePrice,6)});
          
    // Calculate asset allocations
    const assetCount = await Util.tc.getSystemAssetCount(systemId);
    Util.log({assetCount, systemAssets});
    expect(assetCount).to.equal(systemAssets.length);
    
    let expectedAssetAmounts: any = {};
    let expectedNAV = nav;
    for (const assetAddress of systemAssets) {
      expectedAssetAmounts[assetAddress] = await Util.tc.getSystemAssetAmount(systemId, assetAddress);

      const assetValue = await Util.tc.getSystemAssetValue(systemId, assetAddress);
      const assetAllocation = BN6.mul(assetValue).div(nav);
      const fundAmount = assetAllocation.mul(amountIn).div(BN6);      
      Util.log({assetAddress, assetValue, assetAllocation: Util.amountFloat(assetAllocation,4), fundAmount});
      if (fundAmount.isZero())  continue;
      
      if (assetAddress == tokenIn) {
        expectedAssetAmounts[assetAddress] = expectedAssetAmounts[assetAddress].add(fundAmount);

        expectedNAV = expectedNAV.add(fundAmount);
      }
      else {          
        const assetPrice = await Util.assetPrice(assetAddress);
        const poolFee = await Util.poolFee(tokenIn, assetAddress);
        const assetAmount = Util.deductFee(fundAmount.mul(BN18).div(assetPrice), poolFee);
        Util.log({assetPrice, poolFee, assetAmount});
        expectedAssetAmounts[assetAddress] = expectedAssetAmounts[assetAddress].add(assetAmount);
                
        expectedNAV = expectedNAV.add(Util.deductFee(fundAmount, poolFee));
      }
    }
    Util.log({expectedAssetAmounts, expectedNAV});

    let investorShares = await Util.system.balanceOf(investor1.address, systemId);    
    Util.log({investorShares});
    
    // Buy shares
    const numberOfShares = await buyShares(investor1, systemId, tokenIn, amountIn);

    const newNAV = await Util.tc.currentSystemNAV(systemId); 
    Util.log({newNAV});    
    Util.expectApprox(newNAV, expectedNAV, 4);

    const expectedShares = newNAV.sub(nav).div(sharePrice);
    const expectedInvestorShares = investorShares.add(expectedShares);
    Util.log({expectedShares, expectedInvestorShares});
    expect(numberOfShares).to.equal(expectedShares);
  
    investorShares = await Util.system.balanceOf(investor1.address, systemId);
    Util.log({investorShares});
    expect(investorShares).to.equal(expectedInvestorShares);

    await checkAssetAmounts(systemId, expectedAssetAmounts);
    await checkVaultBalances(systemId);
  });

  it("A trader swaps USDC for WETH again", async function () {  
    const systemId = 1;
    const tokenIn = USDC;
    const tokenOut = WETH;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);     
  });
  
  it("A trader can swap WETH for USDC", async function () {
    const systemId = 1;
    const tokenIn = WETH;
    const tokenOut = USDC;    
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);
  });

  it("A trader can swap USDC for UNI", async function () {
    const systemId = 1;
    const tokenIn = USDC;
    const tokenOut = UNI;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);
  });

  it("A trader can swap WETH for UNI", async function () {
    const systemId = 1;
    const tokenIn = WETH;
    const tokenOut = UNI;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);
  });

  it("A trader can swap UNI for USDC", async function () {
    const systemId = 1;
    const tokenIn = UNI;
    const tokenOut = USDC;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);
  });

  it("A trader can swap UNI for WETH", async function () {
    const systemId = 1;
    const tokenIn = UNI;
    const tokenOut = WETH;
    const amountIn = (await Util.tc.getSystemAssetAmount(systemId, tokenIn)).div(BigNumber.from(2));
    await placeOrder(systemId, tokenIn, tokenOut, amountIn);
  });

  it("An investor can sell system shares and receive USDC", async function () {
    const systemId = 1;
    const tokenOut = USDC;
    await testSellShares(investor1, systemId, tokenOut);
  });

  it("An investor can sell system shares and receive WETH", async function () {
    const systemId = 1;
    const tokenOut = WETH;
    await testSellShares(investor1, systemId, tokenOut);
  });
        
});
