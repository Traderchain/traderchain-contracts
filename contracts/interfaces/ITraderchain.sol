// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ITraderchain {
  struct Pool {
    address tokenIn;
    address tokenOut;
    uint24 fee;
  }

  function setTradingSystem(address _tradingSystem) external;

  function addSupportedFund(address fundAddress) external;

  function removeSupportedFund(address fundAddress) external;

  function addSupportedAsset(address assetAddress, Pool[] memory pools) external;

  function removeSupportedAsset(address assetAddress) external;

  function getPoolFee(address tokenIn, address tokenOut) external view returns (uint24);

  function setPoolFee(address tokenIn, address tokenOut, uint24 fee) external;

  function getSystemBaseCurency(uint256 systemId) external view returns (address);

  function getPairPrice(address tokenIn, address tokenOut) external view returns (uint256 pairPrice, address token0);

  function getSystemAssetCount(uint256 systemId) external view returns (uint256);

  function getSystemAssetAmount(uint256 systemId, address assetAddress) external view returns (uint256);

  /// System asset value in a base currency
  function getSystemAssetValue(uint256 systemId, address assetAddress) external view returns (uint256);
  
  /// Current system NAV in a base currency
  function currentSystemNAV(uint256 systemId) external view returns (uint256);
  
  /// Current system share price in a base currency
  function currentSystemSharePrice(uint256 systemId) external view returns (uint256);
  
  function totalSystemShares(uint256 systemId) external view returns (uint256);
  
  function getInvestorShares(uint256 systemId, address investor) external view returns (uint256);
  
  function createTradingSystem(address baseCurrency) external;
  
  /// Investors buy system shares
  function buyShares(uint256 systemId, address tokenIn, uint256 amountIn) external  returns (uint256 numberOfShares);
  
  /// Investors sell system shares and receive funds
  function sellShares(uint256 systemId, uint256 numberOfShares, address tokenOut) external returns (uint256 amountOut);  
    
  /// A trader places a swap order for his own trading system  
  function placeOrder(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut);
}
