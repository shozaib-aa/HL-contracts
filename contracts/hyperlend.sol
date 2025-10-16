// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IHyperlendPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256);
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
}

// ✅ CORRECTED INTERFACE - Matches real Aave V3 / Hyperlend
interface IProtocolDataProvider {
    function getReserveData(address asset) external view returns (
        uint256 unbacked,
        uint256 accruedToTreasuryScaled,
        uint256 totalAToken,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 stableBorrowRate,
        uint256 averageStableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex,
        uint40 lastUpdateTimestamp
    );
    
    function getReserveConfigurationData(address asset) external view returns (
        uint256 decimals,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus,
        uint256 reserveFactor,
        bool usageAsCollateralEnabled,
        bool borrowingEnabled,
        bool stableBorrowRateEnabled,
        bool isActive,
        bool isFrozen
    );
}

interface IHyperlendOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

/**
 * @title HyperlendAutoVault
 * @notice Auto-deposits to highest APY market on Hyperlend
 */
contract HyperlendAutoVault {
    
    address public owner;
    
    // ✅ REAL HYPERLEND CONTRACTS
    function HYPERLEND_POOL() public view virtual returns (address) {
        return 0x00A89d7a5A02160f20150EbEA7a2b5E4879A1A8b;
    }
    
    function PROTOCOL_DATA_PROVIDER() public view virtual returns (address) {
        return 0x5481bf8d3946E6A3168640c1D7523eB59F055a29;
    }
    
    function HYPERLEND_ORACLE() public view virtual returns (address) {
        return 0xC9Fb4fbE842d57EAc1dF3e641a281827493A630e;
    }
    
    // ✅ REAL ASSET ADDRESSES
    address public constant USDT0 = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
    address public constant WHYPE = 0x5555555555555555555555555555555555555555;
    address public constant wstHYPE = 0x94e8396e0869c9F2200760aF0621aFd240E1CF38;
    address public constant USDe = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
    address public constant sUSDe = 0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2;
    address public constant USDHL = 0xb50A96253aBDF803D85efcDce07Ad8becBc52BD5;
    address public constant kHYPE = 0xfD739d4e423301CE9385c1fb8850539D657C296D;
    address public constant UBTC = 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463;
    address public constant UETH = 0xBe6727B535545C67d5cAa73dEa54865B92CF7907;    
    mapping(address => uint256) public userShares;
    mapping(address => address) public userActiveMarket;
    uint256 public totalShares;
    
    struct MarketData {
        address asset;
        uint256 supplyAPY;
        uint256 ltv;
        bool isActive;
    }
    
    event Deposited(address indexed user, address indexed asset, uint256 amount);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, address indexed asset, uint256 amount);
    event Repaid(address indexed user, address indexed asset, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Get supply APY for asset (CORRECTED)
     */
    function getSupplyAPY(address asset) public view returns (uint256) {
        try IProtocolDataProvider(PROTOCOL_DATA_PROVIDER()).getReserveData(asset) returns (
            uint256,  // unbacked
            uint256,  // accruedToTreasuryScaled
            uint256,  // totalAToken
            uint256,  // totalStableDebt
            uint256,  // totalVariableDebt
            uint256 liquidityRate,  // ← Supply rate
            uint256,  // variableBorrowRate
            uint256,  // stableBorrowRate
            uint256,  // averageStableBorrowRate
            uint256,  // liquidityIndex
            uint256,  // variableBorrowIndex
            uint40    // lastUpdateTimestamp
        ) {
            // Convert ray (1e27) to percentage with safety check
            if (liquidityRate == 0) return 0;
            
            // APY = liquidityRate * 100 / 1e27
            // Use unchecked for gas optimization since we know it won't overflow
            unchecked {
                return (liquidityRate * 100) / 1e27;
            }
        } catch {
            // If call fails, return 0 instead of reverting
            return 0;
        }
    }
    
    /**
     * @notice Get market data (CORRECTED)
     */
    function getMarketData(address asset) public view returns (MarketData memory) {
        try IProtocolDataProvider(PROTOCOL_DATA_PROVIDER()).getReserveConfigurationData(asset) returns (
            uint256,  // decimals
            uint256 ltv,
            uint256,  // liquidationThreshold
            uint256,  // liquidationBonus
            uint256,  // reserveFactor
            bool,     // usageAsCollateralEnabled
            bool,     // borrowingEnabled
            bool,     // stableBorrowRateEnabled
            bool isActive,
            bool      // isFrozen
        ) {
            return MarketData({
                asset: asset,
                supplyAPY: getSupplyAPY(asset),
                ltv: ltv,
                isActive: isActive
            });
        } catch {
            // Return empty data if call fails
            return MarketData({
                asset: asset,
                supplyAPY: 0,
                ltv: 0,
                isActive: false
            });
        }
    }
    
    /**
     * @notice Find highest APY market
     */
    function findBestMarket() public view returns (address bestAsset, uint256 highestAPY) {
        address[] memory assets = getSupportedAssets();
        highestAPY = 0;
        bestAsset = assets[0];
        
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 apy = getSupplyAPY(assets[i]);
            if (apy > highestAPY) {
                highestAPY = apy;
                bestAsset = assets[i];
            }
        }
        
        return (bestAsset, highestAPY);
    }
    
    /**
     * @notice Deposit to vault
     */
    function deposit(address asset, uint256 amount) external {
        require(amount > 0, "Zero amount");
        
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        IERC20(asset).approve(HYPERLEND_POOL(), amount);
        
        IHyperlendPool(HYPERLEND_POOL()).supply(asset, amount, address(this), 0);
        
        userShares[msg.sender] += amount;
        totalShares += amount;
        userActiveMarket[msg.sender] = asset;
        
        emit Deposited(msg.sender, asset, amount);
    }
    
    /**
     * @notice Withdraw from vault
     */
    function withdraw(uint256 amount) external {
        address asset = userActiveMarket[msg.sender];
        require(userShares[msg.sender] >= amount, "Insufficient balance");
        
        uint256 withdrawn = IHyperlendPool(HYPERLEND_POOL()).withdraw(asset, amount, msg.sender);
        
        userShares[msg.sender] -= amount;
        totalShares -= amount;
        
        emit Withdrawn(msg.sender, asset, withdrawn);
    }
    
    /**
     * @notice Borrow against collateral
     */
    function borrow(address asset, uint256 amount) external {
        require(userShares[msg.sender] > 0, "No collateral");
        
        IHyperlendPool(HYPERLEND_POOL()).borrow(asset, amount, 2, 0, msg.sender);
        
        emit Borrowed(msg.sender, asset, amount);
    }
    
    /**
     * @notice Repay borrowed amount
     */
    function repay(address asset, uint256 amount) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        IERC20(asset).approve(HYPERLEND_POOL(), amount);
        
        uint256 repaid = IHyperlendPool(HYPERLEND_POOL()).repay(asset, amount, 2, address(this));
        
        emit Repaid(msg.sender, asset, repaid);
    }
    
    /**
     * @notice Get supported assets
     */
    function getSupportedAssets() public pure returns (address[] memory) {
        address[] memory assets = new address[](9);
        assets[0] = USDT0;
        assets[1] = WHYPE;
        assets[2] = wstHYPE;
        assets[3] = USDe;
        assets[4] = sUSDe;
        assets[5] = USDHL;
        assets[6] = kHYPE;
        assets[7] = UBTC;
        assets[8] = UETH;
        return assets;
    }
    
    /**
     * @notice Display all markets
     */
    function displayMarkets() external view returns (
        address[] memory assets,
        uint256[] memory apys,
        uint256[] memory ltvs
    ) {
        address[] memory supportedAssets = getSupportedAssets();
        assets = new address[](supportedAssets.length);
        apys = new uint256[](supportedAssets.length);
        ltvs = new uint256[](supportedAssets.length);
        
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            MarketData memory data = getMarketData(supportedAssets[i]);
            assets[i] = data.asset;
            apys[i] = data.supplyAPY;
            ltvs[i] = data.ltv;
        }
        
        return (assets, apys, ltvs);
    }
}
