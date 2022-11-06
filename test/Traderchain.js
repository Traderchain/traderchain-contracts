const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE,
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');
  
describe("Traderchain", function () {  
  let signers;
  let trader;
  let investor1;
  
  let tc;
  let systemContract;
  
  before(async () => {   
    signers = await ethers.getSigners();
    trader = signers[0];
    investor1 = signers[1];
          
    await Util.initContracts();      
          
    const TradingSystem = await ethers.getContractFactory("TradingSystem");
    systemContract = await TradingSystem.deploy("https://traderchain.org/system/");
    Util.log({'systemContract': systemContract.address});
    
    const Traderchain = await ethers.getContractFactory("Traderchain");
    tc = await Traderchain.deploy(systemContract.address);
    Util.log({'tc': tc.address});
    
    const MINTER_ROLE = await systemContract.MINTER_ROLE();
    await systemContract.grantRole(MINTER_ROLE, tc.address);    
    
    const usdcAmount = Util.amountBN(1000, 6);
    await Util.takeWhaleUSDC(investor1.address, usdcAmount);
  });

  it("Should mint a trading system", async function () {
    const systemId = await systemContract.currentSystemId();
    const toAddress = signers[0].address;
    Util.log({systemId, toAddress});
    
    await tc.connect(signers[0]).mintTradingSystem();
    expect(await systemContract.ownerOf(systemId)).to.equal(toAddress);        
  });
  
  it("Should deposit funds to a system vault", async function () {
    const systemId = 1;
    const vault = await systemContract.getSystemVault(systemId);        
    const usdcAmount = Util.amountBN(100, 6);
    
    await Util.usdcToken.connect(investor1).approve(tc.address, usdcAmount);
    await tc.connect(investor1).depositFunds(systemId, USDC, usdcAmount);
    
    let vaultBalance = await Util.usdcToken.balanceOf(vault);
    Util.log({vaultBalance});
    expect(vaultBalance).to.equal(usdcAmount);
    
    let investorFund = await tc.getInvestorFunds(systemId, investor1.address);
    Util.log({investorFund});
    expect(investorFund).to.equal(usdcAmount);
  });
  
  
});
