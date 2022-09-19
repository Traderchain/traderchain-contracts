// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract OrderUpgradeable is
  AccessControlEnumerableUpgradeable,
  OwnableUpgradeable
{
  bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");  
  uint24 public constant poolFee = 3000;
     
  ISwapRouter private swapRouter;

  /***
   * Public functions
   */
   function initialize(address swapRouter_) initializer public {
     __AccessControlEnumerable_init();
     __Ownable_init();

     _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
     _setupRole(MODERATOR_ROLE, msg.sender);
     
     swapRouter = ISwapRouter(swapRouter_);
   }

  function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerableUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function swapExactInputSingle(address USDC, address WETH, uint256 amountIn) external returns (uint256 amountOut) {      
    TransferHelper.safeTransferFrom(USDC, msg.sender, address(this), amountIn);
    TransferHelper.safeApprove(USDC, address(swapRouter), amountIn);

    ISwapRouter.ExactInputSingleParams memory params =
      ISwapRouter.ExactInputSingleParams({
        tokenIn: USDC,
        tokenOut: WETH,
        fee: poolFee,
        recipient: msg.sender,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });
    
    amountOut = swapRouter.exactInputSingle(params);      
  }
      
  /***
   * Internal functions
   */

}
