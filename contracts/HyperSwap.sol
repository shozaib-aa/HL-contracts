// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IHyperSwapRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);
    
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint[] memory amounts);
    
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint256 amountIn, address[] calldata path) 
        external view returns (uint[] memory amounts);
}

/**
 * @title HyperSwap
 * @notice Multi-token swap aggregator for HyperEVM
 * @dev Integrates with real HyperSwap Router for token swaps
 */
contract HyperSwap {
    
    address public owner;
    address public hyperswapRouter;
    
    // ✅ VERIFIED HYPERSWAP ROUTER ADDRESS
    address public constant HYPERSWAP_ROUTER = 0xb4a9C4e6Ea8E2191d2FA5B380452a634Fb21240A;
    
    // ✅ Real HyperEVM Token Addresses (Verified on HyperEVM Mainnet)
    address public constant WHYPE = 0x5555555555555555555555555555555555555555; // Wrapped HYPE
    address public constant USDT0 = 0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb;
    address public constant USDC = 0xb88339CB7199b77E23DB6E890353E22632Ba630f;
    address public constant USDH = 0x111111a1a0667d36bD57c0A9f569b98057111111;
    address public constant USR = 0x0aD339d66BF4AeD5ce31c64Bc37B3244b6394A77;
    address public constant sUSDe = 0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2;
    address public constant USDe = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
    address public constant UBTC = 0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463;
    address public constant wstHYPE = 0x94e8396e0869c9F2200760aF0621aFd240E1CF38;
    address public constant UETH = 0xBe6727B535545C67d5cAa73dEa54865B92CF7907;
    address public constant beHYPE = 0xd8FC8F0b03eBA61F64D08B0bef69d80916E5DdA9;
    address public constant USDHL = 0xb50A96253aBDF803D85efcDce07Ad8becBc52BD5;
    address public constant USOL = 0x068f321Fa8Fb9f0D135f290Ef6a3e2813e1c8A29;
    
    uint256 public defaultSlippageBps = 50; // 0.5% default slippage
    bool public paused;
    
    struct SwapConfig {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address[] customPath;
    }
    
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event Paused();
    event Unpaused();
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    /**
     * @notice Initialize HyperSwap contract
     * @param _hyperswapRouter Router address (use address(0) for default real router)
     */
    constructor(address _hyperswapRouter) {
        owner = msg.sender;
        
        // ✅ Use provided router or default to verified real router
        if (_hyperswapRouter == address(0)) {
            hyperswapRouter = HYPERSWAP_ROUTER;
        } else {
            hyperswapRouter = _hyperswapRouter;
        }
    }
    
    // ===========================================
    // SWAP FUNCTIONS
    // ===========================================
    
    /**
     * @notice Swap any token to any other token
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output (slippage protection)
     * @param useCustomPath Use custom routing path
     * @param customPath Custom routing path (if needed)
     * @return amountOut Amount of tokens received
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bool useCustomPath,
        address[] calldata customPath
    ) external whenNotPaused returns (uint256 amountOut) {
        require(amountIn > 0, "Zero amount");
        require(tokenIn != tokenOut, "Same token");
        
        // Transfer tokens from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Approve router
        IERC20(tokenIn).approve(hyperswapRouter, amountIn);
        
        // Build swap path
        address[] memory path;
        if (useCustomPath && customPath.length >= 2) {
            path = customPath;
        } else {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
        }
        
        // Execute swap
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        amountOut = amounts[amounts.length - 1];
        
        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Swap HYPE (native) to any token
     * @param tokenOut Token to receive
     * @param minAmountOut Minimum tokens to receive
     * @return amountOut Amount received
     */
    function swapHYPEForToken(
        address tokenOut,
        uint256 minAmountOut
    ) external payable whenNotPaused returns (uint256 amountOut) {
        require(msg.value > 0, "No HYPE sent");
        
        address[] memory path = new address[](2);
        path[0] = WHYPE; // Wrapped HYPE
        path[1] = tokenOut;
        
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).swapExactETHForTokens{value: msg.value}(
            minAmountOut,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        
        emit Swapped(msg.sender, WHYPE, tokenOut, msg.value, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Swap any token to HYPE (native)
     * @param tokenIn Token to swap from
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum HYPE to receive
     * @return amountOut Amount received
     */
    function swapTokenForHYPE(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external whenNotPaused returns (uint256 amountOut) {
        require(amountIn > 0, "Zero amount");
        
        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(hyperswapRouter, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = WHYPE;
        
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).swapExactTokensForETH(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        
        emit Swapped(msg.sender, tokenIn, WHYPE, amountIn, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Batch swap multiple tokens in one transaction
     * @param swaps Array of swap configurations
     * @return amountsOut Array of output amounts
     */
    function batchSwap(
        SwapConfig[] calldata swaps
    ) external whenNotPaused returns (uint256[] memory amountsOut) {
        amountsOut = new uint256[](swaps.length);
        
        for (uint256 i = 0; i < swaps.length; i++) {
            SwapConfig memory config = swaps[i];
            
            // Transfer input token
            IERC20(config.tokenIn).transferFrom(msg.sender, address(this), config.amountIn);
            IERC20(config.tokenIn).approve(hyperswapRouter, config.amountIn);
            
            // Build path
            address[] memory path;
            if (config.customPath.length >= 2) {
                path = config.customPath;
            } else {
                path = new address[](2);
                path[0] = config.tokenIn;
                path[1] = config.tokenOut;
            }
            
            // Swap
            uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).swapExactTokensForTokens(
                config.amountIn,
                config.minAmountOut,
                path,
                msg.sender,
                block.timestamp + 300
            );
            
            amountsOut[i] = amounts[amounts.length - 1];
            
            emit Swapped(msg.sender, config.tokenIn, config.tokenOut, config.amountIn, amountsOut[i]);
        }
        
        return amountsOut;
    }
    
    /**
     * @notice Swap stablecoins (optimized for low slippage)
     * @param stableIn Input stablecoin
     * @param stableOut Output stablecoin
     * @param amountIn Amount to swap
     * @return amountOut Amount received
     */
    function swapStables(
        address stableIn,
        address stableOut,
        uint256 amountIn
    ) external whenNotPaused returns (uint256 amountOut) {
        require(isStablecoin(stableIn) && isStablecoin(stableOut), "Not stablecoins");
        
        // Stablecoins have very low slippage, use tighter tolerance
        uint256 minOut = (amountIn * 9990) / 10000; // 0.1% slippage
        
        IERC20(stableIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(stableIn).approve(hyperswapRouter, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = stableIn;
        path[1] = stableOut;
        
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            msg.sender,
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        emit Swapped(msg.sender, stableIn, stableOut, amountIn, amountOut);
        
        return amountOut;
    }
    
    // ===========================================
    // VIEW FUNCTIONS
    // ===========================================
    
    /**
     * @notice Get quote for swap (no execution)
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Amount to swap
     * @return amountOut Expected output amount
     * @return minAmountOut Minimum output with slippage
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 minAmountOut) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).getAmountsOut(amountIn, path);
        amountOut = amounts[1];
        
        // Calculate min with slippage
        minAmountOut = (amountOut * (10000 - defaultSlippageBps)) / 10000;
        
        return (amountOut, minAmountOut);
    }
    
    /**
     * @notice Get quote with custom path
     * @param amountIn Amount to swap
     * @param path Custom swap path
     * @return amountOut Expected output
     * @return minAmountOut Minimum with slippage
     */
    function getQuoteWithPath(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256 amountOut, uint256 minAmountOut) {
        uint[] memory amounts = IHyperSwapRouter(hyperswapRouter).getAmountsOut(amountIn, path);
        amountOut = amounts[amounts.length - 1];
        minAmountOut = (amountOut * (10000 - defaultSlippageBps)) / 10000;
        return (amountOut, minAmountOut);
    }
    
    /**
     * @notice Check if token is a stablecoin
     * @param token Token address
     * @return bool True if stablecoin
     */
    function isStablecoin(address token) public pure returns (bool) {
        return token == USDT0 || 
               token == USDC || 
               token == USDH || 
               token == USR ||
               token == sUSDe ||
               token == USDe ||
               token == USDHL;
    }
    
    /**
     * @notice Get all supported tokens
     * @return tokens Array of token addresses
     */
    function getSupportedTokens() external pure returns (address[] memory) {
        address[] memory tokens = new address[](13);
        tokens[0] = WHYPE;
        tokens[1] = USDT0;
        tokens[2] = USDC;
        tokens[3] = USDH;
        tokens[4] = USR;
        tokens[5] = sUSDe;
        tokens[6] = USDe;
        tokens[7] = UBTC;
        tokens[8] = wstHYPE;
        tokens[9] = UETH;
        tokens[10] = beHYPE;
        tokens[11] = USDHL;
        tokens[12] = USOL;
        return tokens;
    }
    
    /**
     * @notice Get token info by index
     * @param index Token index (0-12)
     * @return tokenAddress Token address
     * @return name Token name
     */
    function getTokenInfo(uint256 index) external pure returns (
        address tokenAddress,
        string memory name
    ) {
        address[] memory tokens = new address[](13);
        string[] memory names = new string[](13);
        
        tokens[0] = WHYPE; names[0] = "Wrapped HYPE";
        tokens[1] = USDT0; names[1] = "USDT0";
        tokens[2] = USDC; names[2] = "USDC";
        tokens[3] = USDH; names[3] = "USDH";
        tokens[4] = USR; names[4] = "USR";
        tokens[5] = sUSDe; names[5] = "sUSDe";
        tokens[6] = USDe; names[6] = "USDe";
        tokens[7] = UBTC; names[7] = "UBTC";
        tokens[8] = wstHYPE; names[8] = "wstHYPE";
        tokens[9] = UETH; names[9] = "UETH";
        tokens[10] = beHYPE; names[10] = "beHYPE";
        tokens[11] = USDHL; names[11] = "USDHL";
        tokens[12] = USOL; names[12] = "USOL";
        
        require(index < 13, "Invalid index");
        return (tokens[index], names[index]);
    }
    
    // ===========================================
    // ADMIN FUNCTIONS
    // ===========================================
    
    /**
     * @notice Update default slippage tolerance
     * @param newSlippage New slippage in basis points (max 500 = 5%)
     */
    function setSlippage(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 500, "Max 5%");
        uint256 oldSlippage = defaultSlippageBps;
        defaultSlippageBps = newSlippage;
        emit SlippageUpdated(oldSlippage, newSlippage);
    }
    
    /**
     * @notice Update HyperSwap router address
     * @param newRouter New router address
     */
    function setRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        address oldRouter = hyperswapRouter;
        hyperswapRouter = newRouter;
        emit RouterUpdated(oldRouter, newRouter);
    }
    
    /**
     * @notice Pause all swaps
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }
    
    /**
     * @notice Unpause swaps
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }
    
    /**
     * @notice Emergency withdraw tokens
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
