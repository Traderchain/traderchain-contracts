// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import "./SystemVault.sol";

contract TradingSystem is
  Context,
  AccessControlEnumerable,
  ERC721Enumerable
{
    using Counters for Counters.Counter;
    Counters.Counter private _systemIdTracker;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    string public baseURI;
    
    // Mapping system id to value address
    mapping(uint256 => address) public systemVaults;

    /***
     * Public functions
     */
    constructor(string memory _baseURI) ERC721("Traderchain Trading System", "TCTS") {
      baseURI = _baseURI;

      _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
      _setupRole(MINTER_ROLE, _msgSender());        
      
      _systemIdTracker.increment();            
    }

    function mint(address toAddress) public virtual {
      require(hasRole(MINTER_ROLE, _msgSender()), "TradingSystem: must have minter role to mint");

      uint256 systemId = _systemIdTracker.current();

      _mint(toAddress, systemId);
      _createSystemVault(systemId);
      
      _systemIdTracker.increment();
    }
    
    function currentSystemId() public view virtual returns (uint256) {
      return _systemIdTracker.current();
    }
    
    function getSystemVault(uint256 systemId) public view virtual returns (address) {
      return systemVaults[systemId];
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, ERC721Enumerable) returns (bool) {
      return super.supportsInterface(interfaceId);
    }
    
    /***
     * Private functions
     */
     function _createSystemVault(uint256 systemId) private {
        address vault = address(new SystemVault(address(this), systemId));
        systemVaults[systemId] = vault;
     }
     
}
