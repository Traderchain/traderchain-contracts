// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ITraderchain {
  function setTradingSystem(address _tradingSystem) external;

  function addSupportedAsset(address assetAddress) external;

  function removeSupportedAsset(address assetAddress) external;

  function getSystemAssetAmount(uint256 systemId, address assetAddress) external view returns (uint256);

  /// System asset value in USDC (10^6)
  function getSystemAssetValue(uint256 systemId, address assetAddress) external view returns (uint256);
    
  function getPairPrice(address tokenIn, address tokenOut) external view returns (uint256);
    
  /// Current system NAV in USDC (10^6)
  function currentSystemNAV(uint256 systemId) external view returns (uint256);
  
  /// Current system share price in USDC (10^6)
  function currentSystemSharePrice(uint256 systemId) external view returns (uint256);
  
  function totalSystemShares(uint256 systemId) external view returns (uint256);
  
  function getInvestorShares(uint256 systemId, address investor) external view returns (uint256);
  
  function createTradingSystem() external;
  
  /// Investors buy system shares
  function buyShares(uint256 systemId, address tokenIn, uint256 amountIn) external  returns (uint256 numberOfShares);
  
  /// Investors sell system shares and receive funds
  function sellShares(uint256 systemId, uint256 numberOfShares, address tokenOut) external returns (uint256 amountOut);  
    
  /// A trader places a swap order for his own trading system  
  function placeOrder(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut);
}
