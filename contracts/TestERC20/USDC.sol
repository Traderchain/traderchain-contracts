// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./TestERC20.sol";

contract USDC is TestERC20 {

  constructor() TestERC20("USD Coin", "USDC") {
  }

}
