// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ITradingSystem {
    function balanceOf(address account, uint256 systemId) external view returns (uint256);  
    
    function totalSupply(uint256 systemId) external view returns (uint256);

    function exists(uint256 systemId) external view returns (bool);
      
    function setApprovalForAll(address operator, bool approved) external;

    function isApprovedForAll(address account, address operator) external view returns (bool);
 
    function currentSystemId() external view returns (uint256);
    
    function getSystemTrader(uint256 systemId) external view returns (address);
    
    function getTraderSystemsCount(address trader) external view returns (uint256);
    
    function getTraderSystemByIndex(address trader, uint256 index) external view returns (uint256);

    function getSystemVault(uint256 systemId) external view returns (address);
    
    function createSystem(address trader) external;
    
    function mintShares(uint256 systemId, address investor, uint256 shares) external;    
    
    function burnShares(uint256 systemId, address investor, uint256 shares) external;
}
