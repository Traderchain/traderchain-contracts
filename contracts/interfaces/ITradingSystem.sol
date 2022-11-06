// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ITradingSystem {
    function ownerOf(uint256 systemId) external view returns (address);

    function mint(address toAddress) external;
          
    function currentSystemId() external view returns (uint256);
        
    function getSystemVault(uint256 systemId) external view returns (address);  
}
