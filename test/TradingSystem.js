const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO, USDC, WETH, USDC_WHALE, SWAP_ROUTER,
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');
  
describe("TradingSystem", function () {  
  let signers;
  let trader;
  let investor1;
  
  let tc;  
  let system;  
  
  before(async () => {   
    await Util.resetForkState();
    signers = await ethers.getSigners();
    trader = signers[0];
    investor1 = signers[1];
    
    await Util.initContracts();
    tc = Util.tc;
    system = Util.system;
  });

  it("Should mint a trading system and create a system vault", async function () {
    const systemId = await system.currentSystemId();
    Util.log({systemId});
    
    await system.mint(trader.address);
    expect(await system.ownerOf(systemId)).to.equal(trader.address);
    
    const vault = await system.getSystemVault(systemId);
    Util.log({vault});
    expect(vault).not.to.equal(ADDRESS_ZERO);
    
    const vaultContract = await ethers.getContractAt("SystemVault", vault);
    const vaultTradingSystem = await vaultContract.tradingSystem();
    const vaultSystemId = await vaultContract.systemId();
    Util.log({vaultTradingSystem, vaultSystemId});
    expect(vaultTradingSystem).to.equal(system.address);
    expect(vaultSystemId).to.equal(systemId);
    
    const DEFAULT_ADMIN_ROLE = await vaultContract.DEFAULT_ADMIN_ROLE();
    expect(await vaultContract.hasRole(DEFAULT_ADMIN_ROLE, system.address)).to.equal(true);
  });
  
});
