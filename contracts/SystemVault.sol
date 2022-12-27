// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import './interfaces/IERC20.sol';
import "./interfaces/ISystemVault.sol";

contract SystemVault is ISystemVault
{
  address public immutable traderchain;
  address public immutable tradingSystem;
  uint256 public immutable systemId;

  constructor(address _traderchain, address _tradingSystem, uint256 _systemId) {
    traderchain = _traderchain;
    tradingSystem = _tradingSystem;
    systemId = _systemId;
  }

  modifier onlyTraderchain() {
    require(msg.sender == traderchain, "SystemVault: must be called from Traderchain contract");
    _;
  }
  
  function approve(address tokenAdress, uint256 amount) external 
    onlyTraderchain
  {
    IERC20(tokenAdress).approve(traderchain, amount);
  }

}
