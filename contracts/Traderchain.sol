// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import './interfaces/IERC20.sol';
import './interfaces/ISwapRouter.sol';
import "./interfaces/ITradingSystem.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{
  address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; 
  address constant public WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  
  uint24 public constant poolFee = 3000;
  
  ISwapRouter private swapRouter;  
  ITradingSystem private tradingSystem;
  
  // Tracking system funds (USDC only for now)
  mapping(uint256 => uint256) public systemFunds;
  
  // Tracking system assets (WETH only for now)
  mapping(uint256 => uint256) public systemAssets;
  
  // Tracking system share prices (in USDC only for now)
  mapping(uint256 => uint256) public systemSharePrices;
  
  /***
   * Public functions
   */
  constructor(address _swapRouter) {
    swapRouter = ISwapRouter(_swapRouter);
    
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
  
  function getSystemSharePrice(uint256 systemId) public view virtual returns (uint256) {
    return systemSharePrices[systemId];
  }
  
  function createTradingSystem() public {
    address trader = _msgSender();    
    uint256 systemId = tradingSystem.currentSystemId();
    
    tradingSystem.createSystem(trader);
        
    systemSharePrices[systemId] = uint256(10)**6; // 1 Share = 1 USDC
  }
  
  // Investors buy system shares with USDC
  // TODO: Support funds from other ERC20 tokens
  function buyShares(uint256 systemId, uint256 amount) external 
    returns (uint256 numberOfShares)
  {
    require(tradingSystem.getSystemTrader(systemId) != address(0), "TraderChain: systemId not exist");
    require(amount > 0, "TraderChain: amount is empty");
    
    uint256 sharePrice = systemSharePrices[systemId];
    require(sharePrice > 0, "TraderChain: share price is empty");
    
    address investor = _msgSender();                
    address vault = tradingSystem.getSystemVault(systemId);
    IERC20 fund = IERC20(USDC);
    
    // Case 1: system has empty funds
    fund.transferFrom(investor, vault, amount);    
    systemFunds[systemId] += amount;
    
    numberOfShares = amount / sharePrice;
    tradingSystem.mintShares(systemId, investor, numberOfShares);
    
    // TODO: Case 2: funds were allocated
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
  
}
