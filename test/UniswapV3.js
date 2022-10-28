const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
  ADDRESS_ZERO,  
  BigNumber, formatUnits, formatEther,
  Util
} = require('../lib/util');

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; 
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

const USDC_WHALE = '0x7abE0cE388281d2aCF297Cb089caef3819b13448';

describe("UniswapV3", function () {
  let signers;
  
  let usdcToken;
  let wethToken;
    
  let liquidityContract;
  let swapContract;
  
  async function takeWhaleUSDC(signer, amount) {
    const whaleSigner = await ethers.getImpersonatedSigner(USDC_WHALE);
    await usdcToken.connect(whaleSigner).transfer(signer.address, amount);
    
    let usdcBalance = await usdcToken.balanceOf(signer.address);
    Util.log({usdcBalance});
    expect(usdcBalance).to.equal(amount);
  }
  
  before(async () => {    
    signers = await ethers.getSigners();
    
    usdcToken = await ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", USDC);
    wethToken = await ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WETH);

    const UniswapV3Liquidity = await ethers.getContractFactory("UniswapV3Liquidity");
    liquidityContract = await UniswapV3Liquidity.deploy(POSITION_MANAGER);    
    Util.log({'liquidityContract': liquidityContract.address});
    
    const UniswapV3Swap = await ethers.getContractFactory("UniswapV3Swap");
    swapContract = await UniswapV3Swap.deploy(ROUTER);    
    Util.log({'swapContract': swapContract.address});
    
    let usdcWhaleBalance = await usdcToken.balanceOf(USDC_WHALE);
    Util.log({usdcWhaleBalance: formatUnits(usdcWhaleBalance,6)});
    expect(usdcWhaleBalance).to.equal('66419880835583');
        
    // await signers[0].sendTransaction({to: USDC_WHALE, value: Util.amountBN(10), gasLimit: '100000', gasPrice: await ethers.provider.getGasPrice()});
    // expect(await ethers.provider.getBalance(USDC_WHALE)).to.equal(Util.amountBN(10));
  });

  it("Should add liquidity by signers[0]", async function () {
    let usdcAmount = Util.amountBN(1000, 6);
    let wethAmount = Util.amountBN(1);
    Util.log({usdcAmount, wethAmount});

    await takeWhaleUSDC(signers[0], usdcAmount);
    
    await wethToken.deposit({value: wethAmount});
    let wethBalance0 = await wethToken.balanceOf(signers[0].address);
    expect(wethBalance0).to.equal(wethAmount);
            
    await usdcToken.approve(liquidityContract.address, usdcAmount);    
    await wethToken.approve(liquidityContract.address, wethAmount);
                 
    let result = await liquidityContract.callStatic.mintNewPosition(usdcToken.address, wethToken.address, usdcAmount, wethAmount);
    let positionId = result.tokenId, liquidity = result.liquidity, usdcStaked = result.amount0, wethStaked = result.amount1;
    Util.log({positionId, liquidity, usdcStaked, wethStaked});
    await liquidityContract.mintNewPosition(usdcToken.address, wethToken.address, usdcAmount, wethAmount);
    
    usdcBalance0 = await usdcToken.balanceOf(signers[0].address);
    Util.log({usdcBalance0});
    expect(usdcBalance0).to.equal(usdcAmount.sub(usdcStaked));
    
    wethBalance0 = await wethToken.balanceOf(signers[0].address);
    Util.log({wethBalance0});
    expect(wethBalance0).to.equal(wethAmount.sub(wethStaked));
  });
  
  it("Should swap by signers[1]", async function () {
    let usdcAmount = Util.amountBN(1000, 6);    
    Util.log({usdcAmount});
  
    await takeWhaleUSDC(signers[1], usdcAmount);
    
    await usdcToken.connect(signers[1]).approve(swapContract.address, usdcAmount);
    
    let wethAmount = await swapContract.connect(signers[1]).callStatic.swapExactInputSingleHop(usdcToken.address, wethToken.address, usdcAmount);
    Util.log({wethAmount});    
    await swapContract.connect(signers[1]).swapExactInputSingleHop(usdcToken.address, wethToken.address, usdcAmount);
    
    usdcBalance1 = await usdcToken.balanceOf(signers[1].address);
    Util.log({usdcBalance1});
    expect(usdcBalance1).to.equal(0);
    
    let wethBalance1 = await wethToken.balanceOf(signers[1].address);
    Util.log({wethBalance1});
    expect(wethBalance1).to.equal(wethAmount);
  });  

});
