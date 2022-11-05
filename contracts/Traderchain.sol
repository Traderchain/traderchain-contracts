// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{
    constructor() {
      _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

}
