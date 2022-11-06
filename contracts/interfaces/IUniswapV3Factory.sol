// SPDX-License-Identifier: MIT
pragma solidity 0.7.6 || 0.8.10;
pragma abicoder v2;

interface IUniswapV3Factory {
  function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}
