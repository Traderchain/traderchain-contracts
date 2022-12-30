// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/ITraderchain.sol";
import "./interfaces/ITradingSystem.sol";
import "./interfaces/ISystemVault.sol";
import "./libraries/EnumerableMultipleMap.sol";

contract Traderchain is
  Context,
  ITraderchain,
  AccessControlEnumerable
{ 
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableMultipleMap for EnumerableMultipleMap.UintToAddressesMap;
  
  ISwapRouter private swapRouter;  
  IUniswapV3Factory private swapFactory;
  ITradingSystem private tradingSystem;

  // Supported funds (base currencies)
  EnumerableSet.AddressSet private supportedFunds;

  // Supported assets  
  EnumerableSet.AddressSet private supportedAssets;

  // Pool fees
  mapping(address => mapping(address => uint24)) private poolFees; // tokenIn => tokenOut => poolFee

  // System base currency
  mapping(uint256 => address) private systemBaseCurrencies;

  // Tracking systems assets  
  EnumerableMultipleMap.UintToAddressesMap private systemAssets;

  // Tracking system asset amounts
  mapping(uint256 => mapping(address => uint256)) private systemAssetAmounts; // systemId => assetAddress => assetAmount

  /***
   * Public functions
   */
  constructor(address _swapRouter, address _swapFactory) {
    swapRouter = ISwapRouter(_swapRouter);
    swapFactory = IUniswapV3Factory(_swapFactory);
    
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  modifier onlyAdmin() {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Traderchain: must be an admin");
    _;
  }
  
  modifier onlySystemOwner(uint256 systemId) {
    require(_msgSender() == tradingSystem.getSystemTrader(systemId), "Traderchain: must be system owner");
    _;
  }
  
  function setTradingSystem(address _tradingSystem) external onlyAdmin {
    tradingSystem = ITradingSystem(_tradingSystem);
  }

  function addSupportedFund(address fundAddress) external onlyAdmin {
    supportedFunds.add(fundAddress);
  }

  function removeSupportedFund(address fundAddress) external onlyAdmin {
    supportedFunds.remove(fundAddress);
  }

  function addSupportedAsset(address assetAddress, Pool[] memory pools) external onlyAdmin {
    supportedAssets.add(assetAddress);

    for (uint256 i = 0; i < pools.length; i++) {
      Pool memory pool = pools[i];
      poolFees[pool.tokenIn][assetAddress] = pool.fee;
      poolFees[assetAddress][pool.tokenIn] = pool.fee;
    }
  }

  function removeSupportedAsset(address assetAddress) external onlyAdmin {
    supportedAssets.remove(assetAddress);

    for (uint256 i = 0; i < supportedFunds.length(); i++) {
      address fundAddress = supportedFunds.at(i);
      delete poolFees[fundAddress][assetAddress];
      delete poolFees[assetAddress][fundAddress];
    }
  }

  function getPoolFee(address tokenIn, address tokenOut) public view virtual returns (uint24) {
    return poolFees[tokenIn][tokenOut];
  }

  function setPoolFee(address tokenIn, address tokenOut, uint24 fee) external onlyAdmin {
    poolFees[tokenIn][tokenOut] = fee;
    poolFees[tokenOut][tokenIn] = fee;
  }

  function getSystemBaseCurency(uint256 systemId) public view virtual returns (address) {
    return systemBaseCurrencies[systemId];
  }
  
  function getPairPrice(address tokenIn, address tokenOut) public view virtual 
    returns (uint256 pairPrice, address token0)
  {
    uint24 poolFee = getPoolFee(tokenIn, tokenOut);
    IUniswapV3Pool pool = IUniswapV3Pool(swapFactory.getPool(tokenIn, tokenOut, poolFee));
    token0 = pool.token0();

    (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
    pairPrice = (uint256(sqrtPriceX96)**2) / (uint256(2)**192);
  }

  function getSystemAssetCount(uint256 systemId) public view virtual returns (uint256) {
    return systemAssets.count(systemId);
  }

  function getSystemAssetAmount(uint256 systemId, address assetAddress) public view virtual returns (uint256) {
    return systemAssetAmounts[systemId][assetAddress];
  }

  /// System asset value in a base currency
  function getSystemAssetValue(uint256 systemId, address assetAddress) public view virtual returns (uint256) {
    address baseCurrency = getSystemBaseCurency(systemId);
    uint256 assetAmount = systemAssetAmounts[systemId][assetAddress];
    if (assetAddress == baseCurrency)  return assetAmount;

    (uint256 pairPrice, address token0) = getPairPrice(baseCurrency, assetAddress);
    return (baseCurrency == token0) ? (assetAmount / pairPrice) : (assetAmount * pairPrice);
  }

  /// Current system NAV in a base currency
  function currentSystemNAV(uint256 systemId) public view virtual returns (uint256) {
    uint256 assetCount = systemAssets.count(systemId);
    if (assetCount == 0)  return 0;
    
    uint256 nav = 0;
    for (uint256 i = 0; i < assetCount; i++) {
      address assetAddress = systemAssets.getAddress(systemId, i);
      uint256 assetValue = getSystemAssetValue(systemId, assetAddress);
      nav += assetValue;
    }
    return nav;
  }
  
  /// Current system share price in a base currency
  function currentSystemSharePrice(uint256 systemId) public view virtual returns (uint256) {
    uint256 totalShares = tradingSystem.totalSupply(systemId);

    // Initial share price
    if (totalShares == 0) {
      address baseCurrency = getSystemBaseCurency(systemId);
      uint8 decimals = IERC20(baseCurrency).decimals();      
      return 10**(decimals-3); // TODO: review init price for a potential case of switching the base currency
    }
        
    uint256 nav = currentSystemNAV(systemId);
    uint256 sharePrice = nav / totalShares;
    require(sharePrice > 0, "Traderchain: sharePrice should not be 0");
    
    return sharePrice;
  }
  
  function totalSystemShares(uint256 systemId) public view virtual returns (uint256) {
    return tradingSystem.totalSupply(systemId);
  }
  
  function getInvestorShares(uint256 systemId, address investor) public view virtual returns (uint256) {
    return tradingSystem.balanceOf(investor, systemId);
  }
  
  /// Traders create a trading system
  function createTradingSystem(address baseCurrency) public {
    require(supportedFunds.contains(baseCurrency), "Traderchain: baseCurrency is not supported");

    address trader = _msgSender();
    uint256 systemId = tradingSystem.createSystem(trader);
    systemBaseCurrencies[systemId] = baseCurrency;
  }
  
  /// Investors buy system shares
  function buyShares(uint256 systemId, address tokenIn, uint256 amountIn) external 
    returns (uint256 numberOfShares)
  {
    require(tradingSystem.getSystemTrader(systemId) != address(0), "Traderchain: systemId not exist");
    require(tokenIn != address(0), "Traderchain: tokenIn is zero");
    require(supportedFunds.contains(tokenIn), "Traderchain: tokenIn is not supported");
    require(amountIn > 0, "Traderchain: amountIn is empty");
        
    address investor = _msgSender();
    address vault = tradingSystem.getSystemVault(systemId);
    uint256 nav = currentSystemNAV(systemId);
    uint256 sharePrice = currentSystemSharePrice(systemId);
    uint256 assetCount = systemAssets.count(systemId);

    IERC20(tokenIn).transferFrom(investor, address(this), amountIn);
    systemAssets.addAddress(systemId, tokenIn);

    if (nav == 0 || assetCount == 0) {
      IERC20(tokenIn).transfer(vault, amountIn);
      _increaseSystemAssetAmount(systemId, tokenIn, amountIn);      
    }
    else {
      for (uint256 i = 0; i < assetCount; i++) {
        address assetAddress = systemAssets.getAddress(systemId, i);      
        uint256 assetValue = getSystemAssetValue(systemId, assetAddress);
        uint256 assetAllocation = (10**6) * assetValue / nav;
        uint256 fundAmount = assetAllocation * amountIn / (10**6);        
        if (fundAmount == 0)  continue;

        if (assetAddress == tokenIn) {
          IERC20(tokenIn).transfer(vault, fundAmount);
          _increaseSystemAssetAmount(systemId, tokenIn, fundAmount);
        }
        else {          
          uint256 assetAmount = _swapAsset(systemId, tokenIn, assetAddress, fundAmount);
          _increaseSystemAssetAmount(systemId, assetAddress, assetAmount);          
        }
      }
    }
    
    numberOfShares = (currentSystemNAV(systemId) - nav) / sharePrice;
    tradingSystem.mintShares(systemId, investor, numberOfShares);    
  }

  /// Investors sell system shares and receive funds
  function sellShares(uint256 systemId, uint256 numberOfShares, address tokenOut) external 
    returns (uint256 amountOut)
  {
    address investor = _msgSender();    
    require(tradingSystem.getSystemTrader(systemId) != address(0), "Traderchain: systemId not exist");
    require(numberOfShares > 0, "Traderchain: numberOfShares is empty");
    require(numberOfShares <= getInvestorShares(systemId, investor), "Traderchain: numberOfShares is more than investor owning shares");
    require(supportedFunds.contains(tokenOut), "Traderchain: tokenOut is not supported");
        
    address vault = tradingSystem.getSystemVault(systemId);    
    uint256 totalShares = totalSystemShares(systemId);
    uint256 assetCount = systemAssets.count(systemId);

    uint256[] memory assetAmounts = new uint256[](assetCount);
    for (uint256 i = 0; i < assetCount; i++) {
      address assetAddress = systemAssets.getAddress(systemId, i);
      assetAmounts[i] = systemAssetAmounts[systemId][assetAddress] * numberOfShares / totalShares;
    }

    amountOut = 0;    
    for (uint256 i = 0; i < assetCount; i++) {
      address assetAddress = systemAssets.getAddress(systemId, i);
      uint256 assetAmount = assetAmounts[i];
      if (assetAmount == 0)  continue;

      if (assetAddress == tokenOut) {
        amountOut += assetAmount;
        continue;
      }
        
      ISystemVault(vault).approve(assetAddress, assetAmount);
      IERC20(assetAddress).transferFrom(vault, address(this), assetAmount);
      uint256 assetOutAmount = _swapAsset(systemId, assetAddress, tokenOut, assetAmount);         
      amountOut += assetOutAmount;

      _decreaseSystemAssetAmount(systemId, assetAddress, assetAmount);
      _increaseSystemAssetAmount(systemId, tokenOut, assetOutAmount);      
    }
    require(amountOut > 0, "Traderchain: amountOut is empty");
    
    ISystemVault(vault).approve(tokenOut, amountOut);
    IERC20(tokenOut).transferFrom(vault, investor, amountOut);
    
    _decreaseSystemAssetAmount(systemId, tokenOut, amountOut);
    systemAssets.addAddress(systemId, tokenOut);
                  
    tradingSystem.burnShares(systemId, investor, numberOfShares);
  }
  
  /// A trader places a swap order for his own trading system 
  function placeOrder(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) public 
    onlySystemOwner(systemId) 
    returns (uint256 amountOut)
  { 
    require(supportedFunds.contains(tokenIn) || supportedFunds.contains(tokenOut), "Traderchain: swapping pair is not supported");
    require(supportedAssets.contains(tokenIn), "Traderchain: tokenIn is not supported");
    require(supportedAssets.contains(tokenOut), "Traderchain: tokenOut is not supported");
    require(tokenIn != tokenOut, "Traderchain: tokenIn and tokenOut must be different");
    require(amountIn <= systemAssetAmounts[systemId][tokenIn], "Traderchain: amountIn is greater than the amount in vault");
    
    address vault = tradingSystem.getSystemVault(systemId);
      
    ISystemVault(vault).approve(tokenIn, amountIn);
    IERC20(tokenIn).transferFrom(vault, address(this), amountIn);
    amountOut = _swapAsset(systemId, tokenIn, tokenOut, amountIn);
    
    _decreaseSystemAssetAmount(systemId, tokenIn, amountIn);
    _increaseSystemAssetAmount(systemId, tokenOut, amountOut);

    systemAssets.addAddress(systemId, tokenOut);
  }      

  /***
   * Private functions
   */
  function _swapAsset(uint256 systemId, address tokenIn, address tokenOut, uint256 amountIn) internal 
    returns (uint256 amountOut)
  {    
    require(tradingSystem.getSystemTrader(systemId) != address(0), "Traderchain: systemId not exist");
    require(amountIn > 0, "Traderchain: amountIn is empty");

    uint24 poolFee = getPoolFee(tokenIn, tokenOut);
    require(poolFee > 0, "Traderchain: poolFee is empty");
    
    address vault = tradingSystem.getSystemVault(systemId);

    IERC20(tokenIn).approve(address(swapRouter), amountIn);

    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      fee: poolFee,
      recipient: vault,
      deadline: block.timestamp,
      amountIn: amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    });

    amountOut = swapRouter.exactInputSingle(params);
  }

  function _increaseSystemAssetAmount(uint256 systemId, address assetAddress, uint256 assetAmount) internal {
    systemAssetAmounts[systemId][assetAddress] += assetAmount;
  }

  function _decreaseSystemAssetAmount(uint256 systemId, address assetAddress, uint256 assetAmount) internal {
    systemAssetAmounts[systemId][assetAddress] -= assetAmount;
  }
}
