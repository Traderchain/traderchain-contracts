const {deployProxy, upgradeProxy} = require('@openzeppelin/truffle-upgrades');

const USDC = artifacts.require("USDC");
const WETH = artifacts.require("WETH");
const OrderUpgradeable = artifacts.require("OrderUpgradeable");

const toBN = web3.utils.toBN;
const toWei = web3.utils.toWei;

const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

contract("OrderUpgradeable", async (accounts) => {
  let usdcToken;
  let wethToken;
  let swapRouter;
  let orderContract;

  /***
   * Shared functions
   */  
  function amountBN(amount, decimals = 18) {
    return toBN(amount).mul(toBN(10).pow(toBN(decimals)));
  }    

  /***
   * Start testing
   */
  before(async () => {
    usdcToken = await USDC.deployed();
    wethToken = await WETH.deployed();
    swapRouter = process.swapRouter;
    orderContract = await deployProxy(OrderUpgradeable, [swapRouter.address]);
  });

  it("should test", async () => {
    try {
      let amountIn = amountBN(1);
      
      await usdcToken.mint(accounts[0], amountIn);
      
      let balance0 = await usdcToken.balanceOf(accounts[0]);
      console.log(accounts[0], balance0.toString());
      assert(balance0.eq(amountIn), `correct balance`);
      
      await usdcToken.approve(orderContract.address, amountIn);
      
      console.log(usdcToken.address, wethToken.address, amountIn.toString());
      let amountOut = await orderContract.swapExactInputSingle(usdcToken.address, wethToken.address, amountIn);
      
      balance0 = await usdcToken.balanceOf(accounts[0]);
      console.log(accounts[0], balance0.toString());
      assert(balance0.eq(toBN(0)), `correct balance`);
    }
    catch(err) {
      console.error(err);
    }
  });

});
