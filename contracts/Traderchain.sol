// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import './interfaces/IERC20.sol';
import './interfaces/ISwapRouter.sol';
import './interfaces/IUniswapV3Factory.sol';
import './interfaces/IUniswapV3Pool.sol';
import "./interfaces/ITradingSystem.sol";
import "./interfaces/ISystemVault.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{
  address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; 
  address constant public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  
  // Goerli
  // address constant public USDC = 0x07865c6E87B9F70255377e024ace6630C1Eaa37F; 
  // address constant public WETH = 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6;
  
  uint24 public constant poolFee = 3000;
  
  ISwapRouter private swapRouter;  
  IUniswapV3Factory private swapFactory;
  ITradingSystem private tradingSystem;
    
  /// Tracking system funds (USDC only for now)
  mapping(uint256 => uint256) public systemFunds;
  
  /// Tracking system assets (WETH only for now)
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
  
  /// Price of WETH in USDC (10^6)
  function getAssetPrice() public view returns (uint256) {
    uint256 pairPrice = getPairPrice(USDC, WETH);
    return (uint256(10)**18) / pairPrice;    
  }
  
  /// Current system NAV in USDC (10^6)
  function currentSystemNAV(uint256 systemId) public view virtual returns (uint256) {
    uint256 totalShares = tradingSystem.totalSupply(systemId);
    if (totalShares == 0)  return 0;
    
    uint256 wethPrice = getAssetPrice();
    uint256 fundValue = systemFunds[systemId];
    uint256 assetValue = systemAssets[systemId] * wethPrice / (uint256(10)**18);
    return fundValue + assetValue;
  }
  
  /// Current system share price in USDC (10^6)
  function currentSystemSharePrice(uint256 systemId) public view virtual returns (uint256) {
    uint256 totalShares = tradingSystem.totalSupply(systemId);
    if (totalShares == 0)  return 10**3; // Init price: 1 Share = 0.001 USDC
        
    uint256 nav = currentSystemNAV(systemId);
    uint256 sharePrice = nav / totalShares;
    require(sharePrice > 0, "Traderchain: sharePrice should not be 0");
    
    return sharePrice;
  }
  
  function totalSystemShares(uint256 systemId) public view virtual returns (uint256) {
    return tradingSystem.totalSupply(systemId);
  }
  
  function getInvestorShares(uint256 systemId, address investor) public view virtual returns (uint256) {
    return tradingSystem.balanceOf(investor, systemId);
  }
  
  function createTradingSystem() public {
    address trader = _msgSender();    
    tradingSystem.createSystem(trader);        
  }
  
  /// Investors buy system shares with USDC
  /// TODO: Support funds from other ERC20 tokens
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
      uint256 wethAmount = _swapAsset(systemId, USDC, WETH, assetAmount);
      systemAssets[systemId] += wethAmount;  
    }      
    
    numberOfShares = amount / sharePrice;
    tradingSystem.mintShares(systemId, investor, numberOfShares);
  }
  
  /// Investors sell system shares and receive funds
  function sellShares(uint256 systemId, uint256 numberOfShares) external 
    returns (uint256 amountOut)
  {
    address investor = _msgSender();    
    require(tradingSystem.getSystemTrader(systemId) != address(0), "TraderChain: systemId not exist");
    require(numberOfShares > 0, "TraderChain: numberOfShares is empty");
    require(numberOfShares <= getInvestorShares(systemId, investor), "TraderChain: numberOfShares is more than investor owning shares");
        
    address vault = tradingSystem.getSystemVault(systemId);    
    uint256 totalShares = totalSystemShares(systemId);
    
    uint256 assetAmount = systemAssets[systemId] * numberOfShares / totalShares;    
    if (assetAmount > 0) {
      ISystemVault(vault).approve(WETH, assetAmount);
      IERC20(WETH).transferFrom(vault, address(this), assetAmount);
      uint256 usdcAmount = _swapAsset(systemId, WETH, USDC, assetAmount);
      
      systemFunds[systemId] += usdcAmount;
      systemAssets[systemId] -= assetAmount;
    } 
    
    uint256 nav = currentSystemNAV(systemId);
    amountOut = nav * numberOfShares / totalShares;
    
    ISystemVault(vault).approve(USDC, amountOut);
    IERC20(USDC).transferFrom(vault, investor, amountOut);
    systemFunds[systemId] -= amountOut;
                  
    tradingSystem.burnShares(systemId, investor, numberOfShares);
  }
    
  /// A trader places a buy/sell order for his own trading system  
  function placeOrder(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) public 
    onlySystemOwner(systemId) 
    returns (uint256 amountOut)
  { 
    if (tokenIn == USDC) {
      uint256 systemFund = systemFunds[systemId];
      require(amountIn <= systemFund, "Traderchain: not enough system funds");  
    }     
    else if (tokenIn == WETH) {
      uint256 systemAsset = systemAssets[systemId];
      require(amountIn <= systemAsset, "Traderchain: not enough system assets");
    }
    else {
      revert("Traderchain: only USDC and WETH are supported for now");
    }
  
    address vault = tradingSystem.getSystemVault(systemId);
      
    ISystemVault(vault).approve(tokenIn, amountIn);
    IERC20(tokenIn).transferFrom(vault, address(this), amountIn);
    IERC20(tokenIn).approve(address(swapRouter), amountIn);
      
    amountOut = _swapAsset(systemId, tokenIn, tokenOut, amountIn);
    
    if (tokenIn == USDC) {
      systemFunds[systemId] -= amountIn;
      systemAssets[systemId] += amountOut;
    }     
    else if (tokenIn == WETH) {
      systemAssets[systemId] -= amountIn;
      systemFunds[systemId] += amountOut;
    }
  }
      
  function placeBuyOrder(uint256 systemId, uint256 amountIn) external onlySystemOwner(systemId) returns (uint256) { 
    return placeOrder(systemId, USDC, WETH, amountIn);
  }
    
  function placeSellOrder(uint256 systemId, uint256 amountIn) external onlySystemOwner(systemId) returns (uint256) {          
    return placeOrder(systemId, WETH, USDC, amountIn);
  }

  /***
   * Private functions
   */
  function _swapAsset(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) internal 
    returns (uint256 amountOut)
  {
    require(tradingSystem.getSystemTrader(systemId) != address(0), "TraderChain: systemId not exist");
    require(amountIn > 0, "TraderChain: amountIn is empty");    

    address vault = tradingSystem.getSystemVault(systemId);

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
