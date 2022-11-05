const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO,  
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');
  
describe("Traderchain", function () {  
  let signers;
  let tc;
  let systemContract;
  
  before(async () => {   
    signers = await ethers.getSigners();
          
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    systemContract = await TradingSystem.deploy("https://traderchain.org/system/");
    Util.log({'systemContract': systemContract.address});
    
    const Traderchain = await ethers.getContractFactory("Traderchain");
    tc = await Traderchain.deploy(systemContract.address);
    Util.log({'tc': tc.address});
    
    const MINTER_ROLE = await systemContract.MINTER_ROLE();
    await systemContract.grantRole(MINTER_ROLE, tc.address);    
  });

  it("Should mint a trading system", async function () {
    const systemId = await systemContract.currentSystemId();
    const toAddress = signers[0].address;
    Util.log({systemId, toAddress});
    
    await tc.connect(signers[0]).mintTradingSystem();
    expect(await systemContract.ownerOf(systemId)).to.equal(toAddress);        
  });
  
});
