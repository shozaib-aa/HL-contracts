// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProtocolDataProvider {
    function getReserveData(address) external view returns (
        uint256 availableLiquidity,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 stableBorrowRate,
        uint256 averageStableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex,
        uint40 lastUpdateTimestamp
    ) {
        return (
            1000000e6,  // availableLiquidity
            0,          // totalStableDebt
            500000e6,   // totalVariableDebt
            15e25,      // liquidityRate (15% APY in ray format)
            20e25,      // variableBorrowRate
            0,          // stableBorrowRate
            0,          // averageStableBorrowRate
            1e27,       // liquidityIndex
            1e27,       // variableBorrowIndex
            uint40(block.timestamp)
        );
    }
    
    function getReserveConfigurationData(address) external pure returns (
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
    ) {
        return (
            6,      // decimals
            8000,   // 80% LTV
            8500,   // 85% liquidation threshold
            10500,  // 105% liquidation bonus
            1000,   // 10% reserve factor
            true,   // usageAsCollateralEnabled
            true,   // borrowingEnabled
            false,  // stableBorrowRateEnabled
            true,   // isActive
            false   // isFrozen
        );
    }
}
