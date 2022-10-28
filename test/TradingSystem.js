const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO,  
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');
  
describe("TradingSystem", function () {  
  let signers;
  let systemContract;
  
  before(async () => {   
    signers = await ethers.getSigners();
    
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    systemContract = await TradingSystem.deploy("Traderchain Trading System", "TTS", "https://traderchain.org/system/");
    Util.log({'systemContract': systemContract.address});
  });

  it("Should mint a trading system", async function () {
    const tokenId = await systemContract.currentTokenId();
    Util.log({tokenId});
    await systemContract.mint(signers[0].address);
    
    expect(await systemContract.ownerOf(tokenId)).to.equal(signers[0].address);
  });
  
});
