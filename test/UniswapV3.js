const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
  
const BigNumber = ethers.BigNumber;
const formatUnits = ethers.utils.formatUnits;
const formatEther = ethers.utils.formatEther;

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';

describe("UniswapV3", function () {
  let accounts;
  let signer0;
  let signer1;
  
  let usdcToken;
  let wethToken;
    
  let liquidityContract;
  let swapContract;

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
  
  async function takeWhaleUSDC(signer, amount) {
    const whaleSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
    await usdcToken.connect(whaleSigner).transfer(signer.address, amount);
    
    let usdcBalance = await usdcToken.balanceOf(signer.address);
    log({usdcBalance});
    expect(usdcBalance).to.equal(amount);
  }
  
  before(async () => {    
    accounts = await ethers.getSigners();
    signer0 = accounts[0];
    signer1 = accounts[1];
    
    usdcToken = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    wethToken = await ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WETH);

    const UniswapV3Liquidity = await ethers.getContractFactory("UniswapV3Liquidity");
    liquidityContract = await UniswapV3Liquidity.deploy(POSITION_MANAGER);    
    log({'liquidityContract': liquidityContract.address});
    
    const UniswapV3Swap = await ethers.getContractFactory("UniswapV3Swap");
    swapContract = await UniswapV3Swap.deploy(ROUTER);    
    log({'swapContract': swapContract.address});
    
    let usdcWhaleBalance = await usdcToken.balanceOf(USDC_WHALE);
    log({usdcWhaleBalance: formatUnits(usdcWhaleBalance,6)});
    expect(usdcWhaleBalance).to.equal('66419880835583');
        
    // await signer0.sendTransaction({to: USDC_WHALE, value: amountBN(10), gasLimit: '100000', gasPrice: await ethers.provider.getGasPrice()});
    // expect(await ethers.provider.getBalance(USDC_WHALE)).to.equal(amountBN(10));
  });

  it("Should add liquidity by signer0", async function () {
    let usdcAmount = amountBN(1000, 6);
    let wethAmount = amountBN(1);
    log({usdcAmount, wethAmount});

    await takeWhaleUSDC(signer0, usdcAmount);
    
    await wethToken.deposit({value: wethAmount});
    let wethBalance0 = await wethToken.balanceOf(signer0.address);
    expect(wethBalance0).to.equal(wethAmount);
            
    await usdcToken.approve(liquidityContract.address, usdcAmount);    
    await wethToken.approve(liquidityContract.address, wethAmount);
                 
    let result = await liquidityContract.callStatic.mintNewPosition(usdcToken.address, wethToken.address, usdcAmount, wethAmount);
    let positionId = result.tokenId, liquidity = result.liquidity, usdcStaked = result.amount0, wethStaked = result.amount1;
    log({positionId, liquidity, usdcStaked, wethStaked});
    await liquidityContract.mintNewPosition(usdcToken.address, wethToken.address, usdcAmount, wethAmount);
    
    usdcBalance0 = await usdcToken.balanceOf(signer0.address);
    log({usdcBalance0});
    expect(usdcBalance0).to.equal(usdcAmount.sub(usdcStaked));
    
    wethBalance0 = await wethToken.balanceOf(signer0.address);
    log({wethBalance0});
    expect(wethBalance0).to.equal(wethAmount.sub(wethStaked));
  });
  
  it("Should swap by signer1", async function () {
    let usdcAmount = amountBN(1000, 6);    
    log({usdcAmount});
  
    await takeWhaleUSDC(signer1, usdcAmount);
    
    await usdcToken.connect(signer1).approve(swapContract.address, usdcAmount);
    
    let wethAmount = await swapContract.connect(signer1).callStatic.swapExactInputSingleHop(usdcToken.address, wethToken.address, usdcAmount);
    log({wethAmount});    
    await swapContract.connect(signer1).swapExactInputSingleHop(usdcToken.address, wethToken.address, usdcAmount);
    
    usdcBalance1 = await usdcToken.balanceOf(signer1.address);
    log({usdcBalance1});
    expect(usdcBalance1).to.equal(0);
    
    let wethBalance1 = await wethToken.balanceOf(signer1.address);
    log({wethBalance1});
    expect(wethBalance1).to.equal(wethAmount);
  });  

});
