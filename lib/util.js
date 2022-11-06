const { expect } = require("chai");

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';

const SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

const BigNumber = ethers.BigNumber;
const formatUnits = ethers.utils.formatUnits;
const formatEther = ethers.utils.formatEther;

class Util {
  
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
    this.tc = await Traderchain.deploy(SWAP_ROUTER);
    this.log({'tc': this.tc.address});
          
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    this.system = await TradingSystem.deploy(this.tc.address, "https://traderchain.org/system/");
    this.log({'system': this.system.address});
    
    await this.tc.setTradingSystem(this.system.address);
        
    const usdcAmount = this.amountBN(1000, 6);
    await this.takeWhaleUSDC(signers[0].address, usdcAmount);
    await this.takeWhaleUSDC(signers[1].address, usdcAmount);
    
    console.log();
  }  

  amountBN(amount, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  amountStr(amount, decimals = 18) {    
    return formatUnits(amount, decimals);
  }
  
  amountFloat(amount, decimals = 18) {   
    return parseFloat(formatUnits(amount, decimals));
  }
    
  log(values) {
    for (let key in values) {
      let value = values[key];      
      if (BigNumber.isBigNumber(value)) {
        let decimals = value.lt(BigNumber.from(10).pow(10)) ? (value.lt(BigNumber.from(10).pow(6)) ? 0 : 6) : 18;
        value = this.amountStr(value, decimals);
      } 
      
      console.log(`\t${key}: ${value}`);
    }    
  }
  
  async takeWhaleUSDC(toAddress, amount) {
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
    
}

const util = new Util();

module.exports = { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE, SWAP_ROUTER,
  BigNumber, formatUnits, formatEther,
  Util: util
};
