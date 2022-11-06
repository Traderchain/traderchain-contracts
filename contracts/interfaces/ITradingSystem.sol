// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ITradingSystem {
    function balanceOf(address account, uint256 systemId) external view returns (uint256);    
    
    function currentSystemId() external view returns (uint256);
    
    function getSystemTrader(uint256 systemId) external view returns (address);
    
    function getSystemVault(uint256 systemId) external view returns (address);
    
    function createSystem(address trader) external;
    
    function mintShares(uint256 systemId, address toAddress, uint256 amount) external;
    
    function approveFunds(uint256 systemId, address tokenAddress, uint256 amount) external;
}
