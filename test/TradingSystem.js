const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
  
const BigNumber = ethers.BigNumber;
const formatUnits = ethers.utils.formatUnits;
const formatEther = ethers.utils.formatEther;

describe("TradingSystem", function () {
  let accounts;
  let signer0;
  let signer1;
  
  let systemContract;

  function amountBN(amount, decimals = 18) {    
    return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
  }
  
  function amountStr(amount, decimals = 18) {    
    return formatUnits(amount, decimals);
  }
  
  function log(values) {
    for (let key in values) {
      let value = values[key];      
      if (BigNumber.isBigNumber(value)) {
        let decimals = value.lt(BigNumber.from(10).pow(10)) ? (value.lt(BigNumber.from(10).pow(6)) ? 0 : 6) : 18;
        value = amountStr(value, decimals);
      } 
      
      console.log(`\t${key}: ${value}`)
    }    
  }
  
  before(async () => {    
    accounts = await ethers.getSigners();
    signer0 = accounts[0];
    signer1 = accounts[1];
    
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    systemContract = await TradingSystem.deploy("Traderchain Trading System", "TTS", "https://traderchain.org/system/");
    log({'systemContract': systemContract.address});    
  });

  it("Should mint a trading system", async function () {
    const tokenId = await systemContract.currentTokenId();
    log({tokenId});
    await systemContract.mint(signer0.address);
    
    expect(await systemContract.ownerOf(tokenId)).to.equal(signer0.address);
  });
  
});
