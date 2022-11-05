// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./interfaces/ITradingSystem.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{
  
  ITradingSystem public immutable tradingSystem;
  
  /***
   * Public functions
   */
  constructor(address _tradingSystem) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    
    tradingSystem = ITradingSystem(_tradingSystem);
  }

  function mintTradingSystem() public {
    address toAddress = _msgSender();
    
    tradingSystem.mint(toAddress);
  }
  
}
