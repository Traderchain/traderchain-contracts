// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import './interfaces/IERC20.sol';
import './interfaces/ISwapRouter.sol';
import './interfaces/IUniswapV3Factory.sol';
import './interfaces/IUniswapV3Pool.sol';
import "./interfaces/ITradingSystem.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{
  address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; 
  address constant public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  
  uint24 public constant poolFee = 3000;
  
  ISwapRouter private swapRouter;  
  IUniswapV3Factory private swapFactory;
  ITradingSystem private tradingSystem;
  
  // Tracking system funds (USDC only for now)
  mapping(uint256 => uint256) public systemFunds;
  
  // Tracking system assets (WETH only for now)
  mapping(uint256 => uint256) public systemAssets;
  
  /***
   * Public functions
   */
  constructor(address _swapRouter, address _swapFactory) {
    swapRouter = ISwapRouter(_swapRouter);
    swapFactory = IUniswapV3Factory(_swapFactory);
    
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Traderchain: must be an admin");
    _;
  }
  
  modifier onlySystemOwner(uint256 systemId) {
    require(_msgSender() == tradingSystem.getSystemTrader(systemId), "Traderchain: must be system owner");
    _;
  }
  
  function setTradingSystem(address _tradingSystem) external onlyAdmin {
    tradingSystem = ITradingSystem(_tradingSystem);
  }

  function getSystemFund(uint256 systemId) public view virtual returns (uint256) {
    return systemFunds[systemId];
  }
  
  function getSystemAsset(uint256 systemId) public view virtual returns (uint256) {
    return systemAssets[systemId];
  }
    
  function getPairPrice(address tokenIn, address tokenOut) public view returns (uint256) {
    IUniswapV3Pool pool = IUniswapV3Pool(swapFactory.getPool(tokenIn, tokenOut, poolFee));
    (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
    return (uint256(sqrtPriceX96)**2) / (uint256(2)**192);    
  }
  
  // Price of WETH in USDC (10^6)
  function getAssetPrice() public view returns (uint256) {
    uint256 pairPrice = getPairPrice(USDC, WETH);
    return (uint256(10)**18) / pairPrice;    
  }
  
  // Current system NAV in USDC (10^6)
  function currentSystemNAV(uint256 systemId) public view virtual returns (uint256) {
    uint256 totalShares = tradingSystem.totalSupply(systemId);
    if (totalShares == 0)  return 0;
    
    uint256 wethPrice = getAssetPrice();
    uint256 fundValue = systemFunds[systemId];
    uint256 assetValue = systemAssets[systemId] * wethPrice / (uint256(10)**18);
    return fundValue + assetValue;
  }
  
  // Current system share price in USDC (10^6)
  function currentSystemSharePrice(uint256 systemId) public view virtual returns (uint256) {
    uint256 totalShares = tradingSystem.totalSupply(systemId);
    if (totalShares == 0)  return 10**3; // Init price: 1 Share = 0.001 USDC
        
    uint256 nav = currentSystemNAV(systemId);
    uint256 sharePrice = nav / totalShares;
    require(sharePrice > 0, "Traderchain: sharePrice should not be 0");
    
    return sharePrice;
  }
  
  function createTradingSystem() public {
    address trader = _msgSender();    
    tradingSystem.createSystem(trader);        
  }
  
  // Investors buy system shares with USDC
  // TODO: Support funds from other ERC20 tokens
  function buyShares(uint256 systemId, uint256 amount) external 
    returns (uint256 numberOfShares)
  {
    require(tradingSystem.getSystemTrader(systemId) != address(0), "TraderChain: systemId not exist");
    require(amount > 0, "TraderChain: amount is empty");
        
    address investor = _msgSender();
    address vault = tradingSystem.getSystemVault(systemId);
    uint256 nav = currentSystemNAV(systemId);
    uint256 sharePrice = currentSystemSharePrice(systemId);
    
    uint256 fundAllocation = 10**6;
    uint256 assetAllocation = 0;
    if (nav > 0) {
      fundAllocation = (10**6) * systemFunds[systemId] / nav;
      assetAllocation = (10**6) - fundAllocation;
    }
    
    uint256 assetAmount = assetAllocation * amount / (10**6);
    uint256 fundAmount = amount - assetAmount;
    
    IERC20(USDC).transferFrom(investor, vault, fundAmount);
    systemFunds[systemId] += fundAmount;
    
    if (assetAmount > 0) {
      IERC20(USDC).transferFrom(investor, address(this), assetAmount);
      uint256 wethAmount = _buyAsset(systemId, assetAmount);
      systemAssets[systemId] += wethAmount;  
    }      
    
    numberOfShares = amount / sharePrice;
    tradingSystem.mintShares(systemId, investor, numberOfShares);
  }
    
  // Trader places a buy order for his system
  function placeBuyOrder(uint256 systemId, uint256 buyAmount) external 
    onlySystemOwner(systemId) 
    returns (uint256 amountOut)
  {
    // require((buyAmount > 0 || sellAmount > 0) && (buyAmount == 0 || sellAmount == 0), "Traderchain: either buyAmount or sellAmount should be set");
      
    uint256 systemFund = systemFunds[systemId];
    require(buyAmount <= systemFund, "Traderchain: not enough system funds");
  
    address vault = tradingSystem.getSystemVault(systemId);
    address tokenIn = USDC;
    address tokenOut = WETH;
    uint256 amountIn = buyAmount;
      
    IERC20(tokenIn).transferFrom(vault, address(this), amountIn);
    IERC20(tokenIn).approve(address(swapRouter), amountIn);
  
    ISwapRouter.ExactInputSingleParams memory params = 
      ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: poolFee,
        recipient: vault,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });
    
    amountOut = swapRouter.exactInputSingle(params);
    
    systemFunds[systemId] -= amountIn;
    systemAssets[systemId] += amountOut;
  }

  /***
   * Private functions
   */
  function _buyAsset(uint256 systemId, uint256 amountIn) internal 
    returns (uint256 amountOut)
  {
    require(tradingSystem.getSystemTrader(systemId) != address(0), "TraderChain: systemId not exist");
    require(amountIn > 0, "TraderChain: amountIn is empty");    
    
    address vault = tradingSystem.getSystemVault(systemId);
    address tokenIn = USDC;
    address tokenOut = WETH;
          
    IERC20(tokenIn).approve(address(swapRouter), amountIn);
  
    ISwapRouter.ExactInputSingleParams memory params = 
      ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: poolFee,
        recipient: vault,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });
    
    amountOut = swapRouter.exactInputSingle(params);
  }
    
}
