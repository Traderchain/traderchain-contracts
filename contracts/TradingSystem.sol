// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import "./interfaces/ISystemVault.sol";
import "./SystemVault.sol";

contract TradingSystem is
  Context,
  AccessControlEnumerable,
  ERC1155Supply
{
  using Counters for Counters.Counter;
  Counters.Counter private _systemIdTracker;

  address public immutable traderchain;  
  
  // Mapping system id to trader address
  mapping(uint256 => address) public systemTraders;
  
  // Support enumeration for the list of systems owned by a trader
  mapping(address => mapping(uint256 => uint256)) private traderSystems;
  mapping(uint256 => uint256) private traderSystemsIndex;
  mapping(address => uint256) private traderSystemsCount;
  
  // Mapping system id to vault address
  mapping(uint256 => address) public systemVaults;

  /***
   * Public functions
   */
  constructor(address _traderchain, string memory uri) ERC1155(uri) {
    traderchain = _traderchain;

    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());    
    
    _systemIdTracker.increment();
  }

  modifier onlyTraderchain() {
    require(_msgSender() == traderchain, "TradingSystem: must be called from Traderchain contract");
    _;
  }
  
  modifier onlySystemOwner(uint256 systemId) {
    require(_msgSender() == systemTraders[systemId], "TradingSystem: must be system owner");    
    _;
  }
  
  function currentSystemId() public view virtual returns (uint256) {
    return _systemIdTracker.current();
  }
  
  function getSystemTrader(uint256 systemId) public view virtual returns (address) {
    return systemTraders[systemId];
  }
  
  function getTraderSystemsCount(address trader) public view virtual returns (uint256) {
    return traderSystemsCount[trader];
  }
  
  function getTraderSystemByIndex(address trader, uint256 index) public view virtual returns (uint256) {
    return traderSystems[trader][index];
  }

  function getSystemVault(uint256 systemId) public view virtual returns (address) {
    return systemVaults[systemId];
  }
  
  function createSystem(address trader) public virtual 
    onlyTraderchain
  {  
    uint256 systemId = _systemIdTracker.current();

    systemTraders[systemId] = trader;
    _addSystemToTraderEnumeration(trader, systemId);
    _createSystemVault(systemId);
    
    _systemIdTracker.increment();
  }
  
  function mintShares(uint256 systemId, address investor, uint256 shares) public virtual 
    onlyTraderchain
  {
    require(systemTraders[systemId] != address(0), "TradingSystem: systemId not exist");
    require(shares > 0, "TradingSystem: shares is empty");
    
    _mint(investor, systemId, shares, "");
  }
    
  function burnShares(uint256 systemId, address investor, uint256 shares) public virtual
    onlyTraderchain
  {
    require(systemTraders[systemId] != address(0), "TradingSystem: systemId not exist");
    require(shares > 0, "TradingSystem: shares is empty");
    require(shares <= balanceOf(investor, systemId), "TradingSystem: shares is more than investor owning shares");
  
    _burn(investor, systemId, shares);
  }
      
  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, ERC1155) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
  
  /***
   * Private functions
   */
  function _createSystemVault(uint256 systemId) private {
    address vault = address(new SystemVault(traderchain, address(this), systemId));
    systemVaults[systemId] = vault;
  }
  
  function _addSystemToTraderEnumeration(address trader, uint256 systemId) private {
    uint256 index = traderSystemsCount[trader];
    traderSystems[trader][index] = systemId;
    traderSystemsIndex[systemId] = index;
    traderSystemsCount[trader] += 1;
  }

  function _removeSystemFromTraderEnumeration(address trader, uint256 systemId) private {
    uint256 lastIndex = traderSystemsCount[trader] - 1;
    uint256 index = traderSystemsIndex[systemId];

    if (index != lastIndex) {
        uint256 lastSystemId = traderSystems[trader][lastIndex];
        traderSystems[trader][index] = lastSystemId;
        traderSystemsIndex[lastSystemId] = index;
    }

    delete traderSystemsIndex[systemId];
    delete traderSystems[trader][lastIndex];
    traderSystemsCount[trader] -= 1;
  }
     
}
