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

  function addId(AddressToUintsMap storage map, address addr, uint256 id) internal returns (bool) {
    if (exists(map, addr, id))  return false;

    uint256 index = map.counts[addr];
    map.data[addr][index] = id;
    map.indexes[id] = index;
    map.counts[addr] += 1;

    return true;
  }

  function removeId(AddressToUintsMap storage map, address addr, uint256 id) internal returns (bool) {
    if (!exists(map, addr, id))  return false;

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

    return true;
  }


  struct UintToAddressesMap {
    mapping(uint256 => mapping(uint256 => address)) data; // id => index => addr
    mapping(address => uint256) indexes; // address => index
    mapping(uint256 => uint256) counts; // id => count
  }

  function count(UintToAddressesMap storage map, uint256 id) internal view returns (uint256) {
    return map.counts[id];
  }
  
  function getAddress(UintToAddressesMap storage map, uint256 id, uint256 index) internal view returns (address) {
    return map.data[id][index];
  }

  function exists(UintToAddressesMap storage map, uint256 id, address addr) internal view returns (bool) {
    return map.indexes[addr] > 0 || map.data[id][0] == addr;
  }

  function addAddress(UintToAddressesMap storage map, uint256 id, address addr) internal returns (bool) {
    if (exists(map, id, addr))  return false;

    uint256 index = map.counts[id];
    map.data[id][index] = addr;
    map.indexes[addr] = index;
    map.counts[id] += 1;

    return true;
  }

  function removeAddress(UintToAddressesMap storage map, uint256 id, address addr) internal returns (bool) {
    if (!exists(map, id, addr))  return false;

    uint256 lastIndex = map.counts[id] - 1;
    uint256 index = map.indexes[addr];

    if (index < lastIndex) {
        address lastAddress = map.data[id][lastIndex];
        map.data[id][index] = lastAddress;
        map.indexes[lastAddress] = index;
    }

    delete map.indexes[addr];
    delete map.data[id][lastIndex];
    map.counts[id] -= 1;

    return true;
  }

}