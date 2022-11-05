// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract SystemVault is
  Context,
  AccessControlEnumerable
{
  address public immutable systemFactory;
  uint256 public immutable systemId;

  constructor(address _systemFactory, uint256 _systemId) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    
    systemFactory = _systemFactory;
    systemId = _systemId;
  }

}
