
const ADDRESS_ZERO = module.exports.ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

const BigNumber = ethers.BigNumber;
const formatUnits = ethers.utils.formatUnits;
const formatEther = ethers.utils.formatEther;

class Util {
  
  constructor() {
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
      
      console.log(`\t${key}: ${value}`)
    }    
  }
    
}

const util = new Util();

module.exports = { 
  ADDRESS_ZERO,
  BigNumber, formatUnits, formatEther,
  Util: util, 
};
