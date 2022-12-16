// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';
import './interfaces/IERC721Receiver.sol';
import './interfaces/INonfungiblePositionManager.sol';

contract UniswapV3Liquidity is IERC721Receiver {
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = -MIN_TICK;
    int24 private constant TICK_SPACING = 60;
        
    INonfungiblePositionManager public nonfungiblePositionManager;

    constructor(address manager) {
      nonfungiblePositionManager = INonfungiblePositionManager(manager);
    }

    function onERC721Received(address, address, uint, bytes calldata) 
      external pure override
      returns (bytes4) 
    {
      return IERC721Receiver.onERC721Received.selector;
    }

    function mintNewPosition(address USDC, address WETH, uint amount0ToAdd, uint amount1ToAdd) 
      external       
      returns (uint tokenId, uint128 liquidity, uint amount0, uint amount1)
    {        
        IERC20 usdc = IERC20(USDC);
        IWETH weth = IWETH(WETH);
        
        usdc.transferFrom(msg.sender, address(this), amount0ToAdd);
        weth.transferFrom(msg.sender, address(this), amount1ToAdd);
        
        usdc.approve(address(nonfungiblePositionManager), amount0ToAdd);
        weth.approve(address(nonfungiblePositionManager), amount1ToAdd);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
          token0: USDC,
          token1: WETH,
          fee: 3000,
          tickLower: (MIN_TICK / TICK_SPACING) * TICK_SPACING,
          tickUpper: (MAX_TICK / TICK_SPACING) * TICK_SPACING,
          amount0Desired: amount0ToAdd,
          amount1Desired: amount1ToAdd,
          amount0Min: 0,
          amount1Min: 0,
          recipient: address(this),
          deadline: block.timestamp
        });
        
        (tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager.mint(params);
        
        if (amount0 < amount0ToAdd) {
            usdc.approve(address(nonfungiblePositionManager), 0);
            uint refund0 = amount0ToAdd - amount0;
            usdc.transfer(msg.sender, refund0);
        }
        if (amount1 < amount1ToAdd) {
            weth.approve(address(nonfungiblePositionManager), 0);
            uint refund1 = amount1ToAdd - amount1;
            weth.transfer(msg.sender, refund1);
        }
    }

    function collectAllFees(uint tokenId)
      external
      returns (uint amount0, uint amount1)
    {
      INonfungiblePositionManager.CollectParams
        memory params = INonfungiblePositionManager.CollectParams({
          tokenId: tokenId,
          recipient: address(this),
          amount0Max: type(uint128).max,
          amount1Max: type(uint128).max
        });
  
      (amount0, amount1) = nonfungiblePositionManager.collect(params);
    }

    function increaseLiquidityCurrentRange(address USDC, address WETH, uint tokenId, uint amount0ToAdd, uint amount1ToAdd) 
      external 
      returns (uint128 liquidity, uint amount0, uint amount1)
    {
      // TODO: retrieve ERC20 token info from tokenId
      IERC20 usdc = IERC20(USDC);
      IWETH weth = IWETH(WETH);
      
      usdc.transferFrom(msg.sender, address(this), amount0ToAdd);
      weth.transferFrom(msg.sender, address(this), amount1ToAdd);
  
      usdc.approve(address(nonfungiblePositionManager), amount0ToAdd);
      weth.approve(address(nonfungiblePositionManager), amount1ToAdd);
  
      INonfungiblePositionManager.IncreaseLiquidityParams
        memory params = INonfungiblePositionManager.IncreaseLiquidityParams({
          tokenId: tokenId,
          amount0Desired: amount0ToAdd,
          amount1Desired: amount1ToAdd,
          amount0Min: 0,
          amount1Min: 0,
          deadline: block.timestamp
        });
  
      (liquidity, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);
    }

    function decreaseLiquidityCurrentRange(uint tokenId, uint128 liquidity)
        external
        returns (uint amount0, uint amount1)
    {
      INonfungiblePositionManager.DecreaseLiquidityParams
        memory params = INonfungiblePositionManager.DecreaseLiquidityParams({
          tokenId: tokenId,
          liquidity: liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: block.timestamp
        });
  
      (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(params);
    }
}
