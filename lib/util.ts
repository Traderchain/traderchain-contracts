import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumberish } from "ethers";

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const UNI = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

export const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';
export const WETH_WHALE = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

export const INIT_SUPPORT_FUNDS = [USDC, WETH];
export const INIT_SUPPORT_ASSETS = [
  { assetAddress: USDC, pools: [ {tokenIn: WETH, tokenOut: USDC, fee: 3000} ] },
  { assetAddress: WETH, pools: [] },
  { assetAddress: UNI, pools: [ {tokenIn: WETH, tokenOut: UNI, fee: 3000}, {tokenIn: USDC, tokenOut: UNI, fee: 3000} ] },  
];
export const ASSET_NAMES: any = { [USDC]: 'USDC', [WETH]: 'WETH', [UNI]: 'UNI' };

export const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const SWAP_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const SWAP_POOL_WETH_USDC = '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8';

export const BigNumber = ethers.BigNumber;
export const parseEther = ethers.utils.parseEther;
export const parseUnits = ethers.utils.parseUnits;
export const formatUnits = ethers.utils.formatUnits;
export const formatEther = ethers.utils.formatEther;

export const BN0 = BigNumber.from(0);
export const BN6 = parseUnits('1',6);
export const BN18 = parseUnits('1',18);

const ASSET_CONTRACTS: any = {};

class Util {
  usdc: any;
  weth: any;
  tc: any;
  system: any;
  
  constructor() {    
  }
    
  async resetForkState() {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/Bcipbi3wYgtmrR-gkp6Fdc888i3N3ixG",
            blockNumber: 15812970,
          }
        }
      ]
    });
  } 
    
  async initContracts() {
    const signers = await ethers.getSigners();
    
    this.usdc = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    this.weth = await ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WETH);    
    ASSET_CONTRACTS[USDC] = this.usdc;
    ASSET_CONTRACTS[WETH] = this.weth;
    
    for (const asset of INIT_SUPPORT_ASSETS) { 
      const {assetAddress} = asset;
      if (INIT_SUPPORT_FUNDS.includes(assetAddress))  continue;

      ASSET_CONTRACTS[assetAddress] = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", assetAddress);
    }
    
    const Traderchain = await ethers.getContractFactory("Traderchain");
    this.tc = await Traderchain.deploy(SWAP_ROUTER, SWAP_FACTORY);
    this.log({'tc': this.tc.address});
          
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    this.system = await TradingSystem.deploy(this.tc.address, "https://traderchain.org/system/");
    this.log({'system': this.system.address});
    
    await this.tc.setTradingSystem(this.system.address);

    for (const fund of INIT_SUPPORT_FUNDS) { 
      await this.tc.addSupportedFund(fund); 
    }

    for (const asset of INIT_SUPPORT_ASSETS) { 
      const {assetAddress, pools} = asset;
      this.log({assetAddress});

      await this.tc.addSupportedAsset(assetAddress, pools);

      const assetPrice = await this.assetPrice(assetAddress);
      this.log({assetPrice});

      for (const pool of pools) {
        const poolFee1 = await this.tc.getPoolFee(pool.tokenIn, pool.tokenOut);
        const poolFee2 = await this.tc.getPoolFee(pool.tokenOut, pool.tokenIn);
        this.log({pool, poolFee1, poolFee2});
        expect(poolFee1).to.equal(pool.fee);
        expect(poolFee2).to.equal(pool.fee);
      }      
    }
        
    const usdcAmount = this.amountBN(10000, 6);
    await this.takeWhaleUSDC(signers[0].address, usdcAmount);
    await this.takeWhaleUSDC(signers[1].address, usdcAmount);
    
    const wethAmount = parseEther('10.0');
    await this.takeWhaleWETH(signers[0].address, wethAmount);
    await this.takeWhaleWETH(signers[1].address, wethAmount);

    console.log();
  }  

  amountBN(amount: number, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  amountStr(amount: BigNumberish, decimals = 18) {    
    return formatUnits(amount, decimals);
  }
  
  amountFloat(amount: BigNumberish, decimals = 18) {   
    return parseFloat(formatUnits(amount, decimals));
  }
    
  deductFee(amount: any, fee: number) {
    const d1 = 1000000000;
    const d2 = d1 / 100;
    return amount.mul(BigNumber.from(d1 - Math.floor(d2*fee))).div(BigNumber.from(d1));
  }

  log(values: any) {
    const _formatStr = (s: any) => {
      if (typeof s != 'string')  return s;
      return ASSET_NAMES[s] ? `${ASSET_NAMES[s]}_${s}` : s;
    };

    for (let key in values) {
      let value = values[key];

      if (BigNumber.isBigNumber(value)) {
        if (key.includes('Shares')) {
          value = value.toString();
        } 
        else {
          const decimals = value.lt(BigNumber.from(10).pow(10)) ? (value.lt(BigNumber.from(10).pow(6)) ? 0 : 6) : 18;
          value = this.amountStr(value, decimals);
        }
      }
      else if (typeof value == 'object') {
        for (const k in value) {
          this.log({ [`${key} ${_formatStr(k)}`]: value[k] });
        }
        continue;
      }
                  
      console.log(`\t${_formatStr(key)}: ${_formatStr(value)}`);
    }
  }
  
  expectApprox(a: BigNumberish, b: BigNumberish, decimals = 18) {
    console.log('\tUtil.expectApprox()');
    const af = this.amountFloat(a, decimals).toFixed(0);
    const bf = this.amountFloat(b, decimals).toFixed(0);
    this.log({af, bf});
    expect(af).to.equal(bf);
  }

  assetContract(assetAddress: string) {    
    return ASSET_CONTRACTS[assetAddress];
  }

  async assetPrice(assetAddress: string, baseCurrency = USDC) {    
    return await this.tc.getAssetValue(baseCurrency, assetAddress, BN18);
  }

  async poolFee(tokenIn: string, tokenOut: string) {
    const fee = await this.tc.getPoolFee(tokenIn, tokenOut);
    return this.amountFloat(fee, 4);
  }

  async takeWhaleUSDC(toAddress: string, amount: BigNumberish) {
    console.log('\tUtil.takeWhaleUSDC()');
    this.log({toAddress, amount});
    
    let usdcBalance = await this.usdc.balanceOf(toAddress);
    const newUsdcBalance = usdcBalance.add(amount);
    
    const whaleSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
    await this.usdc.connect(whaleSigner).transfer(toAddress, amount);
    
    usdcBalance = await this.usdc.balanceOf(toAddress);
    this.log({toAddress, usdcBalance});
    expect(usdcBalance).to.equal(newUsdcBalance);
  }
  
  async takeWhaleWETH(toAddress: string, amount: BigNumberish) {
    console.log('\tUtil.takeWhaleWETH()');
    this.log({toAddress, amount});
    
    let wethBalance = await this.weth.balanceOf(toAddress);
    const newWethBalance = wethBalance.add(amount);
    
    const whaleSigner = await ethers.getImpersonatedSigner(WETH_WHALE);
    await this.weth.connect(whaleSigner).transfer(toAddress, amount);
    
    wethBalance = await this.weth.balanceOf(toAddress);
    this.log({toAddress, wethBalance});
    expect(wethBalance).to.equal(newWethBalance);
  }

  async takeWhaleETH(to: string, value: BigNumberish) {
    console.log('\tUtil.takeWhaleETH()');
    this.log({to, value});
    
    const provider = ethers.provider;
    const signers = await ethers.getSigners();
          
    let balance = await provider.getBalance(to);
    const newBalance = balance.add(value);

    await signers[0].sendTransaction({to, value});
    
    balance = await provider.getBalance(to);
    this.log({to, balance});
    expect(balance).to.equal(newBalance);
  }
    
}

const util = new Util();
export default util;