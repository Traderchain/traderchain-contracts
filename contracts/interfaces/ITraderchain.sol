// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ITraderchain {
  function setTradingSystem(address _tradingSystem) external;

  function getSystemFund(uint256 systemId) external view returns (uint256);
  
  function getSystemAsset(uint256 systemId) external view returns (uint256);
    
  function getPairPrice(address tokenIn, address tokenOut) external view returns (uint256);
  
  /// Price of WETH in USDC (10^6)
  function getAssetPrice() external view returns (uint256);
  
  /// Current system NAV in USDC (10^6)
  function currentSystemNAV(uint256 systemId) external view returns (uint256);
  
  /// Current system share price in USDC (10^6)
  function currentSystemSharePrice(uint256 systemId) external view returns (uint256);
  
  function totalSystemShares(uint256 systemId) external view returns (uint256);
  
  function getInvestorShares(uint256 systemId, address investor) external view returns (uint256);
  
  function createTradingSystem() external;
  
  /// Investors buy system shares with USDC
  /// TODO: Support funds from other ERC20 tokens
  function buyShares(uint256 systemId, uint256 amount) external  returns (uint256 numberOfShares);
  
  /// Investors sell system shares and receive funds
  function sellShares(uint256 systemId, uint256 numberOfShares) external returns (uint256 amountOut);  
    
  /// A trader places a buy/sell order for his own trading system  
  function placeOrder(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut);
        
  function placeBuyOrder(uint256 systemId, uint256 amountIn) external returns (uint256);
    
  function placeSellOrder(uint256 systemId, uint256 amountIn) external returns (uint256);
}
