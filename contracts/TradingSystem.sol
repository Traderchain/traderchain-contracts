// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract TradingSystem is
  Context,
  AccessControlEnumerable,
  ERC721Enumerable
{
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdTracker;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    string public baseURI;

    constructor(string memory name, string memory symbol, string memory _baseURI) ERC721(name, symbol) {
      baseURI = _baseURI;

      _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
      _setupRole(MINTER_ROLE, _msgSender());        
      
      _tokenIdTracker.increment();
    }

    function mint(address toAddress) public virtual {
      require(hasRole(MINTER_ROLE, _msgSender()), "TradingSystem: must have minter role to mint");

      _mint(toAddress, _tokenIdTracker.current());
      _tokenIdTracker.increment();
    }
    
    function currentTokenId() public view virtual returns (uint256) {
      return _tokenIdTracker.current();
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, ERC721Enumerable) returns (bool) {
      return super.supportsInterface(interfaceId);
    }
}
