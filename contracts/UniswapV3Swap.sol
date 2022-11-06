// SPDX-License-Identifier: MIT
// pragma solidity ^0.8.13;
pragma solidity 0.7.6 || 0.8.10;
pragma abicoder v2;

import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';
import './interfaces/ISwapRouter.sol';

contract UniswapV3Swap {    
    ISwapRouter private router;

    uint24 public constant poolFee = 3000;

    constructor(address router_) {
      router = ISwapRouter(router_);
    }

    function swapExactInputSingleHop(address tokenIn, address tokenOut, uint amountIn) 
      external 
      returns (uint amountOut) 
    {
      IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
      IERC20(tokenIn).approve(address(router), amountIn);

      ISwapRouter.ExactInputSingleParams memory params = 
        ISwapRouter.ExactInputSingleParams({
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          fee: poolFee,
          recipient: msg.sender,
          deadline: block.timestamp,
          amountIn: amountIn,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        });

      amountOut = router.exactInputSingle(params);
    }

    function swapExactInputMultiHop(bytes calldata path, address tokenIn, uint amountIn) 
      external 
      returns (uint amountOut) 
    {
      IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
      IERC20(tokenIn).approve(address(router), amountIn);

      ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
        path: path,
        recipient: msg.sender,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0
      });
      
      amountOut = router.exactInput(params);
    }
}
