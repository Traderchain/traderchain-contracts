// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

import "./interfaces/ITradingSystem.sol";
import "./interfaces/ISystemVault.sol";
import "./libraries/EnumerableMultipleMap.sol";
import "./SystemVault.sol";

contract TradingSystem is
  Context,
  ITradingSystem,
  AccessControlEnumerable,
  ERC1155Supply
{
  using Counters for Counters.Counter;
  Counters.Counter private _systemIdTracker;

  address public immutable traderchain;
  
  // Mapping system id to trader address
  mapping(uint256 => address) private systemTraders;
  
  // Tracking systems owned by a trader
  using EnumerableMultipleMap for EnumerableMultipleMap.AddressToUintsMap;
  EnumerableMultipleMap.AddressToUintsMap private traderSystems;

  // Mapping system id to vault address
  mapping(uint256 => address) private systemVaults;

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
  
  function totalSupply(uint256 systemId) public view virtual override(ITradingSystem, ERC1155Supply) returns (uint256) {
    return ERC1155Supply.totalSupply(systemId);
  }

  function exists(uint256 systemId) public view virtual override(ITradingSystem, ERC1155Supply) returns (bool) {
    return ERC1155Supply.exists(systemId);
  }

  function currentSystemId() public view virtual returns (uint256) {
    return _systemIdTracker.current();
  }
  
  function getSystemTrader(uint256 systemId) public view virtual returns (address) {
    return systemTraders[systemId];
  }
  
  function getTraderSystemsCount(address trader) public view virtual returns (uint256) {
    return traderSystems.count(trader);
  }
  
  function getTraderSystemByIndex(address trader, uint256 index) public view virtual returns (uint256) {
    return traderSystems.getId(trader, index);
  }

  function getSystemVault(uint256 systemId) public view virtual returns (address) {
    return systemVaults[systemId];
  }
  
  function createSystem(address trader) public virtual
    onlyTraderchain
    returns (uint256)
  {  
    uint256 systemId = _systemIdTracker.current();

    systemTraders[systemId] = trader;
    traderSystems.addId(trader, systemId);
    _createSystemVault(systemId);
    
    _systemIdTracker.increment();
    return systemId;
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
      
  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, IERC165, ERC1155) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
  
  // TODO: allow to transfer a system's ownership

  /***
   * Private functions
   */
  function _createSystemVault(uint256 systemId) private {
    address vault = address(new SystemVault(traderchain, address(this), systemId));
    systemVaults[systemId] = vault;
  }
   
}
