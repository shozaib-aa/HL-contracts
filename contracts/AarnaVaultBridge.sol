// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IDeBridgeGate {
    function send(
        address tokenAddress,
        uint256 amount,
        uint256 chainIdTo,
        bytes memory receiver,
        bytes memory permit,
        bool useAssetFee,
        uint32 referralCode,
        bytes calldata autoParams
    ) external payable;
    
    function globalFixedNativeFee() external view returns (uint256);
    function getChainFee(uint256 chainId) external view returns (uint256);
}

contract AarnaBridge {
    
    // Core
    address public owner;
    address public deBridgeGate;
    address public usdcAddress;
    address public feeRecipient;
    
    // Settings
    uint256 public slippageBps = 50; // 0.5%
    uint256 public minBridgeAmount = 10e6; // 10 USDC
    uint256 public maxBridgeAmount = 1000000e6; // 1M USDC
    bool public paused;
    
    // Stats
    uint256 public totalVolumeDeposited;
    uint256 public totalVolumeWithdrawn;
    uint256 public totalFeeCollected;
    mapping(address => uint256) public userTotalDeposits;
    mapping(address => uint256) public userTotalWithdrawals;
    mapping(address => uint256) public userDepositCount;
    
    // History
    struct BridgeTx {
        address user;
        uint256 amount;
        uint256 timestamp;
        uint256 chainFrom;
        uint256 chainTo;
        bool isDeposit;
    }
    BridgeTx[] public bridgeHistory;
    mapping(address => uint256[]) public userTxIds;
    
    // Events
    event Deposit(address indexed user, uint256 amount, uint256 fee);
    event Withdraw(address indexed user, uint256 amount, uint256 fee);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }
    
    constructor(address _deBridgeGate, address _usdcAddress) {
        owner = msg.sender;
        feeRecipient = msg.sender;
        deBridgeGate = _deBridgeGate;
        usdcAddress = _usdcAddress;
    }
    
    function deposit(uint256 amount) external payable whenNotPaused {
        require(amount > 0, "Zero amount");
        require(amount >= minBridgeAmount, "Amount too small");
        require(amount <= maxBridgeAmount, "Amount too large");
        
        uint256 bridgeFee = getBridgeFee();
        require(msg.value >= bridgeFee, "Insufficient fee");
        
        // Transfer USDC
        IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);
        IERC20(usdcAddress).approve(deBridgeGate, amount);
        
        // Bridge
        IDeBridgeGate(deBridgeGate).send{value: bridgeFee}(
            usdcAddress,
            amount,
            999, // HyperEVM
            abi.encodePacked(msg.sender),
            "",
            false,
            0,
            ""
        );
        
        // Track
        userTotalDeposits[msg.sender] += amount;
        userDepositCount[msg.sender]++;
        totalVolumeDeposited += amount;
        totalFeeCollected += msg.value;
        
        // History
        bridgeHistory.push(BridgeTx({
            user: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            chainFrom: 1,
            chainTo: 999,
            isDeposit: true
        }));
        userTxIds[msg.sender].push(bridgeHistory.length - 1);
        
        emit Deposit(msg.sender, amount, bridgeFee);
    }
    
    function withdraw(uint256 amount) external payable whenNotPaused {
        require(amount > 0, "Zero amount");
        require(amount >= minBridgeAmount, "Amount too small");
        require(amount <= maxBridgeAmount, "Amount too large");
        
        uint256 bridgeFee = getBridgeFee();
        require(msg.value >= bridgeFee, "Insufficient fee");
        
        // Transfer USDC
        IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);
        IERC20(usdcAddress).approve(deBridgeGate, amount);
        
        // Bridge
        IDeBridgeGate(deBridgeGate).send{value: bridgeFee}(
            usdcAddress,
            amount,
            1, // Ethereum
            abi.encodePacked(msg.sender),
            "",
            false,
            0,
            ""
        );
        
        // Track
        userTotalWithdrawals[msg.sender] += amount;
        totalVolumeWithdrawn += amount;
        totalFeeCollected += msg.value;
        
        // History
        bridgeHistory.push(BridgeTx({
            user: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            chainFrom: 999,
            chainTo: 1,
            isDeposit: false
        }));
        userTxIds[msg.sender].push(bridgeHistory.length - 1);
        
        emit Withdraw(msg.sender, amount, bridgeFee);
    }
    
    // View functions
    function getQuote(uint256 amount) external view returns (
        uint256 outputAmount,
        uint256 bridgeFee,
        uint256 gasEstimate
    ) {
        uint256 slippage = (amount * slippageBps) / 10000;
        outputAmount = amount - slippage;
        bridgeFee = getBridgeFee();
        gasEstimate = 200000;
        return (outputAmount, bridgeFee, gasEstimate);
    }
    
    function getBridgeFee() public view returns (uint256) {
        uint256 baseFee = IDeBridgeGate(deBridgeGate).globalFixedNativeFee();
        uint256 chainFee = IDeBridgeGate(deBridgeGate).getChainFee(999);
        return baseFee + chainFee + 0.0005 ether;
    }
    
    function getUserStats(address user) external view returns (
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 depositCount
    ) {
        return (
            userTotalDeposits[user],
            userTotalWithdrawals[user],
            userDepositCount[user]
        );
    }
    
    function getUserHistory(address user) external view returns (BridgeTx[] memory) {
        uint256[] memory txIds = userTxIds[user];
        BridgeTx[] memory history = new BridgeTx[](txIds.length);
        for (uint256 i = 0; i < txIds.length; i++) {
            history[i] = bridgeHistory[txIds[i]];
        }
        return history;
    }
    
    function getStats() external view returns (
        uint256 deposits,
        uint256 withdrawals,
        uint256 fees
    ) {
        return (totalVolumeDeposited, totalVolumeWithdrawn, totalFeeCollected);
    }
    
    // Admin functions
    function setLimits(uint256 min, uint256 max) external onlyOwner {
        require(min < max, "Invalid limits");
        minBridgeAmount = min;
        maxBridgeAmount = max;
    }
    
    function setSlippage(uint256 newSlippage) external onlyOwner {
        require(newSlippage <= 500, "Max 5%");
        slippageBps = newSlippage;
    }
    
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(feeRecipient).transfer(balance);
    }
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
    
    receive() external payable {}
}
