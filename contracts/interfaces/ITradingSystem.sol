// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface ITradingSystem is IERC1155 {
  /// ERC1155Supply interfaces
  function totalSupply(uint256 systemId) external view returns (uint256);
  
  function exists(uint256 systemId) external view returns (bool);

  /// TradingSystem interfaces
  function currentSystemId() external view returns (uint256);
  
  function getSystemTrader(uint256 systemId) external view returns (address);
  
  function getTraderSystemsCount(address trader) external view returns (uint256);
  
  function getTraderSystemByIndex(address trader, uint256 index) external view returns (uint256);

  function getSystemVault(uint256 systemId) external view returns (address);
  
  function createSystem(address trader) external returns (uint256);
  
  function mintShares(uint256 systemId, address investor, uint256 shares) external;    
  
  function burnShares(uint256 systemId, address investor, uint256 shares) external;
}
