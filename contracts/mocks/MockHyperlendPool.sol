// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockHyperlendPool {
    address public usdt0;
    address public whype;
    
    constructor(address _usdt0, address _whype) {
        usdt0 = _usdt0;
        whype = _whype;
    }
    
    function supply(address asset, uint256 amount, address, uint16) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
    }
    
    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        IERC20(asset).transfer(to, amount);
        return amount;
    }
    
    function borrow(address asset, uint256 amount, uint256, uint16, address onBehalfOf) external {
        IERC20(asset).transfer(onBehalfOf, amount);
    }
    
    function repay(address asset, uint256 amount, uint256, address) external returns (uint256) {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        return amount;
    }
    
    function getUserAccountData(address) external pure returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    ) {
        return (
            10000e8,  // $10,000 collateral
            5000e8,   // $5,000 debt
            3000e8,   // $3,000 available to borrow
            8500,     // 85% liquidation threshold
            8000,     // 80% LTV
            2e18      // Health factor 2.0
        );
    }
}
