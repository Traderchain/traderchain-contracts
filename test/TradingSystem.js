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
    systemContract = await TradingSystem.deploy("https://traderchain.org/system/");
    Util.log({'systemContract': systemContract.address});
  });

  it("Should mint a trading system and create a system vault", async function () {
    const systemId = await systemContract.currentSystemId();
    Util.log({systemId});
    
    await systemContract.mint(signers[0].address);
    expect(await systemContract.ownerOf(systemId)).to.equal(signers[0].address);
    
    const vault = await systemContract.getSystemVault(systemId);
    Util.log({vault});
    expect(vault).not.to.equal(ADDRESS_ZERO);
    
    const vaultContract = await ethers.getContractAt("SystemVault", vault);
    const vaultSystemFactory = await vaultContract.systemFactory();
    const vaultSystemId = await vaultContract.systemId();
    Util.log({vaultSystemFactory, vaultSystemId});
    expect(vaultSystemFactory).to.equal(systemContract.address);
    expect(vaultSystemId).to.equal(systemId);
    
    const DEFAULT_ADMIN_ROLE = await vaultContract.DEFAULT_ADMIN_ROLE();
    expect(await vaultContract.hasRole(DEFAULT_ADMIN_ROLE, systemContract.address)).to.equal(true);
  });
  
});
