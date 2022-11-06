// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import './interfaces/IERC20.sol';
import "./interfaces/ITradingSystem.sol";

contract Traderchain is
  Context,
  AccessControlEnumerable
{

  address constant public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; 
  
  ITradingSystem public immutable tradingSystem;
  
  // Tracking system funds (USDC only for now)
  mapping(uint256 => uint256) public systemFunds;
  
  // Tracking investor funds in each system (USDC only for now)
  mapping(uint256 => mapping(address => uint256)) public investorFunds;
  
  /***
   * Public functions
   */
  constructor(address _tradingSystem) {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    
    tradingSystem = ITradingSystem(_tradingSystem);
  }

  function getSystemFunds(uint256 systemId) public view virtual returns (uint256) {
    return systemFunds[systemId];
  }
  
  function getInvestorFunds(uint256 systemId, address investor) public view virtual returns (uint256) {
    return investorFunds[systemId][investor];
  }

  function mintTradingSystem() public {
    address toAddress = _msgSender();
    
    tradingSystem.mint(toAddress);
  }
  
  function depositFunds(uint256 systemId, address tokenAddress, uint256 amount) external payable {
    require(tokenAddress == USDC, "Traderchain: only USDC can be deposited for now");
    // TODO: Support funding from other ERC20 tokens
    
    address investor = _msgSender();            
    address vault = tradingSystem.getSystemVault(systemId);
    IERC20 token = IERC20(tokenAddress);
    
    token.transferFrom(investor, vault, amount);
    
    investorFunds[systemId][investor] += amount;
    systemFunds[systemId] += amount;
  }
  
}
