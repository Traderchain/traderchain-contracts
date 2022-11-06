// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import './interfaces/IERC20.sol';

contract SystemVault is
  Context,
  AccessControlEnumerable
{
  address public immutable traderchain;
  address public immutable tradingSystem;
  uint256 public immutable systemId;

  constructor(address _traderchain, address _tradingSystem, uint256 _systemId) {
    traderchain = _traderchain;
    tradingSystem = _tradingSystem;
    systemId = _systemId;
    
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "SystemVault: must be an admin");
    _;
  }

  function approve(address tokenAdress, uint256 amount) external onlyAdmin {
    IERC20(tokenAdress).approve(traderchain, amount);
  }

}
