const { expect } = require("chai");

const ADDRESS_ZERO = module.exports.ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';

const BigNumber = ethers.BigNumber;
const formatUnits = ethers.utils.formatUnits;
const formatEther = ethers.utils.formatEther;

class Util {
  
  constructor() {    
  }
    
  async initContracts() {
    this.usdcToken = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    this.wethToken = await ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WETH);
  }  
    
  amountBN(amount, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  amountStr(amount, decimals = 18) {    
    return formatUnits(amount, decimals);
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
    
    const usdcToken = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    const whaleSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
    
    await usdcToken.connect(whaleSigner).transfer(toAddress, amount);
    
    const usdcBalance = await usdcToken.balanceOf(toAddress);
    this.log({toAddress, usdcBalance});
    expect(usdcBalance).to.equal(amount);
  }
    
}

const util = new Util();

module.exports = { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE,
  BigNumber, formatUnits, formatEther,
  Util: util
};
