import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumberish } from "ethers";

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';
export const INIT_SUPPORT_ASSETS = [USDC, WETH];

export const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const SWAP_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const SWAP_POOL_WETH_USDC = '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8';

export const BigNumber = ethers.BigNumber;
export const formatUnits = ethers.utils.formatUnits;
export const formatEther = ethers.utils.formatEther;

class Util {
  usdcToken: any;
  wethToken: any;
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
    
    this.usdcToken = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    this.wethToken = await ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WETH);
    
    const Traderchain = await ethers.getContractFactory("Traderchain");
    this.tc = await Traderchain.deploy(SWAP_ROUTER, SWAP_FACTORY);
    this.log({'tc': this.tc.address});
          
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    this.system = await TradingSystem.deploy(this.tc.address, "https://traderchain.org/system/");
    this.log({'system': this.system.address});
    
    await this.tc.setTradingSystem(this.system.address);
    for (let asset of INIT_SUPPORT_ASSETS) {
      await this.tc.addSupportedAsset(asset);
    }
        
    const usdcAmount = this.amountBN(1000, 6);
    await this.takeWhaleUSDC(signers[0].address, usdcAmount);
    await this.takeWhaleUSDC(signers[1].address, usdcAmount);
    
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
    
  log(values: any) {
    for (let key in values) {
      let value = values[key];      
      if (BigNumber.isBigNumber(value)) {
        let decimals = value.lt(BigNumber.from(10).pow(10)) ? (value.lt(BigNumber.from(10).pow(6)) ? 0 : 6) : 18;
        value = this.amountStr(value, decimals);
      } 
      
      console.log(`\t${key}: ${value}`);
    }    
  }
  
  async assetPrice(assetAddress: string) {
    const price = await this.tc.getPairPrice(USDC, assetAddress);
    return this.amountBN(1).div(price);
  }

  async takeWhaleUSDC(toAddress: string, amount: BigNumberish) {
    console.log('\tUtil.takeWhaleUSDC()');
    this.log({toAddress, amount});
    
    let usdcBalance = await this.usdcToken.balanceOf(toAddress);
    const newUsdcBalance = usdcBalance.add(amount);
    
    const whaleSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
    await this.usdcToken.connect(whaleSigner).transfer(toAddress, amount);
    
    usdcBalance = await this.usdcToken.balanceOf(toAddress);
    this.log({toAddress, usdcBalance});
    expect(usdcBalance).to.equal(newUsdcBalance);
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