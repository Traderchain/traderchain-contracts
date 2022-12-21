// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

library EnumerableMultipleMap {

  struct AddressToUintsMap {
    mapping(address => mapping(uint256 => uint256)) data; // addr => index => id
    mapping(uint256 => uint256) indexes; // id => index
    mapping(address => uint256) counts; // addr => count
  }
  
  function count(AddressToUintsMap storage map, address addr) internal view returns (uint256) {
    return map.counts[addr];
  }
  
  function getId(AddressToUintsMap storage map, address addr, uint256 index) internal view returns (uint256) {
    return map.data[addr][index];
  }

  function exists(AddressToUintsMap storage map, address addr, uint256 id) internal view returns (bool) {
    return map.indexes[id] > 0 || map.data[addr][0] == id;
  }

  function addId(AddressToUintsMap storage map, address addr, uint256 id) internal {    
    require(!exists(map, addr, id), "Enumeration: id already added");

    uint256 index = map.counts[addr];
    map.data[addr][index] = id;
    map.indexes[id] = index;
    map.counts[addr] += 1;
  }

  function removeId(AddressToUintsMap storage map, address addr, uint256 id) internal {
    require(exists(map, addr, id), "Enumeration: id doesn't exist");

    uint256 lastIndex = map.counts[addr] - 1;
    uint256 index = map.indexes[id];

    if (index < lastIndex) {
        uint256 lastId = map.data[addr][lastIndex];
        map.data[addr][index] = lastId;
        map.indexes[lastId] = index;
    }

    delete map.indexes[id];
    delete map.data[addr][lastIndex];
    map.counts[addr] -= 1;
  }
}