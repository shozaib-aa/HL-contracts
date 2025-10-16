// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockHyperSwapRouter {
    
    address public usdc;
    address public usdt0;
    address public hype;
    
    constructor(address _usdc, address _usdt0, address _hype) {
        usdc = _usdc;
        usdt0 = _usdt0;
        hype = _hype;
    }
    
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint[] memory amounts) {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        uint256 amountOut = (amountIn * 995) / 1000;
        IERC20(path[path.length - 1]).transfer(to, amountOut);
        
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
        
        return amounts;
    }
    
    function swapExactETHForTokens(
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external payable returns (uint[] memory amounts) {
        uint256 ethAmount = msg.value; // 18 decimals
        
        // 1 ETH = 1000 USDC
        // Convert: 1e18 ETH -> 1000 * 1e6 USDC
        uint256 amountOut = (ethAmount * 1000 * 1e6) / 1e18; // Convert to 6 decimals
        amountOut = (amountOut * 995) / 1000; // 0.5% fee
        
        IERC20(path[1]).transfer(to, amountOut);
        
        amounts = new uint[](2);
        amounts[0] = ethAmount;
        amounts[1] = amountOut;
        
        return amounts;
    }
    
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint[] memory amounts) {
        // Transfer tokens from user
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        // 1000 USDC (1000 * 1e6) = 1 ETH (1e18)
        // Convert: amountIn (6 decimals) -> ETH (18 decimals)
        uint256 ethOut = (amountIn * 1e18) / (1000 * 1e6); // Convert to 18 decimals
        ethOut = (ethOut * 995) / 1000; // 0.5% fee
        
        require(address(this).balance >= ethOut, "Router: Insufficient ETH");
        require(ethOut >= amountOutMin, "Router: Insufficient output");
        
        (bool success, ) = payable(to).call{value: ethOut}("");
        require(success, "ETH transfer failed");
        
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = ethOut;
        
        return amounts;
    }
    
    function getAmountsOut(uint256 amountIn, address[] calldata path) 
        external pure returns (uint[] memory amounts) 
    {
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        uint256 currentAmount = amountIn;
        
        for (uint i = 1; i < path.length; i++) {
            // Check if converting from ETH to token or vice versa
            bool isFromETH = (i == 1 && path[0] == address(0x5555555555555555555555555555555555555555));
            bool isToETH = (i == path.length - 1 && path[i] == address(0x5555555555555555555555555555555555555555));
            
            if (isFromETH) {
                // ETH (18 decimals) -> USDC (6 decimals)
                // 1 ETH = 1000 USDC
                currentAmount = (currentAmount * 1000 * 1e6) / 1e18;
            } else if (isToETH) {
                // USDC (6 decimals) -> ETH (18 decimals)
                // 1000 USDC = 1 ETH
                currentAmount = (currentAmount * 1e18) / (1000 * 1e6);
            }
            
            // Apply fee
            currentAmount = (currentAmount * 995) / 1000;
            amounts[i] = currentAmount;
        }
        
        return amounts;
    }
    
    receive() external payable {}
}
