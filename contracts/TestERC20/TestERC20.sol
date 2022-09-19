// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is AccessControl, Ownable, ERC20 {
  bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

  constructor(string memory name_, string memory symbol_)
    ERC20(name_, symbol_) 
  {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(MODERATOR_ROLE, msg.sender);
  }

  modifier onlyModerator() {
    require(hasRole(MODERATOR_ROLE, msg.sender), "Function can only be called by a moderator");
    _;
  }

  function mint(address to, uint256 amount) external onlyModerator {
    _mint(to, amount);
  }

  function burn(address account, uint256 amount) external onlyModerator {
    _burn(account, amount);
  }
}
