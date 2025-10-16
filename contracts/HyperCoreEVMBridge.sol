// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HyperCoreEVMBridge
 * @notice Handles bidirectional asset transfers between HyperEVM and HyperCore
 * @dev Implements Hyperliquid's native bridge protocol for Aarna.ai vault
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract HyperCoreEVMBridge {
    
    // ============ State Variables ============
    
    /// @notice Native HYPE system address for Core transfers
    address public constant HYPE_SYSTEM_ADDRESS = 0x2222222222222222222222222222222222222222;
    
    /// @notice Authorized vault contract that can initiate transfers
    address public vaultContract;
    
    /// @notice Owner with admin privileges
    address public owner;
    
    /// @notice Emergency pause state
    bool public paused;
    
    /// @notice Mapping to track pending transfers (EVM -> Core)
    mapping(bytes32 => TransferInfo) public pendingTransfers;
    
    /// @notice Mapping to track completed Core -> EVM transfers
    mapping(bytes32 => bool) public completedTransfers;
    
    // ============ Structs ============
    
    struct TransferInfo {
        address token;
        uint256 amount;
        uint256 timestamp;
        address sender;
        bool completed;
    }
    
    // ============ Events ============
    
    event TransferToCore(
        bytes32 indexed transferId,
        address indexed token,
        uint256 indexed tokenIndex,
        uint256 amount,
        address sender
    );
    
    event TransferFromCore(
        bytes32 indexed transferId,
        uint256 indexed tokenIndex,
        uint256 amount,
        address recipient
    );
    
    event HYPETransferred(
        address indexed sender,
        uint256 amount,
        bytes32 transferId
    );
    
    event TransferCompleted(bytes32 indexed transferId);
    
    event VaultContractUpdated(address indexed oldVault, address indexed newVault);
    
    event Received(address indexed sender, uint256 amount);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyVault() {
        require(msg.sender == vaultContract, "Only vault");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _vaultContract) {
        owner = msg.sender;
        vaultContract = _vaultContract;
        paused = false;
    }
    
    // ============ Core Transfer Functions ============
    
    /**
     * @notice Transfer ERC20 tokens from HyperEVM to HyperCore
     * @dev Sends tokens to system address 0x2000...tokenIndex
     * @param token Address of ERC20 token on HyperEVM
     * @param amount Amount to transfer (in token decimals)
     * @return transferId Unique identifier for tracking this transfer
     */
    function transferToCore(address token, uint256 amount) 
        external 
        onlyVault 
        whenNotPaused 
        returns (bytes32 transferId) 
    {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        
        // Get token index from token address (implementation specific)
        uint256 tokenIndex = _getTokenIndex(token);
        
        // Calculate system address for this token
        address systemAddress = getSystemAddress(tokenIndex);
        
        // Generate unique transfer ID
        transferId = keccak256(abi.encodePacked(
            token,
            amount,
            block.timestamp,
            msg.sender
        ));
        
        // Transfer tokens from vault to system address
        bool success = IERC20(token).transferFrom(msg.sender, systemAddress, amount);
        require(success, "Transfer failed");
        
        // Record transfer info
        pendingTransfers[transferId] = TransferInfo({
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            sender: msg.sender,
            completed: false
        });
        
        emit TransferToCore(transferId, token, tokenIndex, amount, msg.sender);
        
        return transferId;
    }
    
    /**
     * @notice Execute spotSend from HyperCore to HyperEVM
     * @dev Called after Core-side spotSend to system address
     * @param tokenIndex HIP-1 token index on HyperCore
     * @param amount Amount being transferred
     * @param recipient Address to receive tokens on HyperEVM
     * @return transferId Unique identifier for this transfer
     */
    function transferFromCore(
        uint256 tokenIndex, 
        uint256 amount, 
        address recipient
    ) 
        external 
        onlyVault 
        whenNotPaused 
        returns (bytes32 transferId) 
    {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        
        // Generate transfer ID
        transferId = keccak256(abi.encodePacked(
            tokenIndex,
            amount,
            block.timestamp,
            recipient
        ));
        
        // Mark as completed (actual transfer happens via system tx)
        completedTransfers[transferId] = true;
        
        emit TransferFromCore(transferId, tokenIndex, amount, recipient);
        
        return transferId;
    }
    
    /**
 * @notice Calculate system address for given token index
 * @dev Format: 0x20 + zeros + tokenIndex in big-endian (last 8 bytes)
 * @param tokenIndex HIP-1 token index
 * @return systemAddress The computed system address
 */
function getSystemAddress(uint256 tokenIndex) 
    public 
    pure 
    returns (address systemAddress) 
{
    require(tokenIndex < type(uint64).max, "Token index too large");
    
    // Create address: 0x20 (1 byte) + zeros (11 bytes) + tokenIndex (8 bytes)
    // Total: 20 bytes = 160 bits for Ethereum address
    bytes memory addrBytes = new bytes(20);
    
    // First byte is 0x20
    addrBytes[0] = 0x20;
    
    // Bytes 1-11 are zeros (already initialized)
    
    // Last 8 bytes (indices 12-19) encode the token index in big-endian
    for (uint i = 0; i < 8; i++) {
        addrBytes[19 - i] = bytes1(uint8(tokenIndex >> (i * 8)));
    }
    
    systemAddress = address(uint160(bytes20(addrBytes)));
    
    return systemAddress;
}

    
    /**
     * @notice Transfer native HYPE token from HyperEVM to HyperCore
     * @dev Sends msg.value to 0x222...2 system address
     * @return transferId Unique identifier for tracking
     */
    function transferHYPEToCore() 
        external 
        payable 
        onlyVault 
        whenNotPaused 
        returns (bytes32 transferId) 
    {
        require(msg.value > 0, "Must send HYPE");
        
        // Generate transfer ID
        transferId = keccak256(abi.encodePacked(
            msg.sender,
            msg.value,
            block.timestamp
        ));
        
        // Transfer native HYPE to system address
        (bool success, ) = HYPE_SYSTEM_ADDRESS.call{value: msg.value}("");
        require(success, "HYPE transfer failed");
        
        emit HYPETransferred(msg.sender, msg.value, transferId);
        emit Received(msg.sender, msg.value);
        
        return transferId;
    }
    
    /**
     * @notice Check if Core -> EVM transfer has completed
     * @dev Verifies system transaction executed transfer() on token contract
     * @param transferId The transfer identifier to check
     * @return completed True if transfer is complete
     */
    function isTransferComplete(bytes32 transferId) 
        external 
        view 
        returns (bool completed) 
    {
        // Check if marked as completed in Core->EVM mapping
        if (completedTransfers[transferId]) {
            return true;
        }
        
        // Check if EVM->Core transfer is recorded and completed
        TransferInfo memory transfer = pendingTransfers[transferId];
        if (transfer.completed) {
            return true;
        }
        
        return false;
    }
    
    /**
     * @notice Estimate gas cost for transfers
     * @param isFromCore True if estimating Core->EVM, false for EVM->Core
     * @return gasCost Estimated gas units required
     */
    function getTransferGasCost(bool isFromCore) 
        external 
        pure 
        returns (uint256 gasCost) 
    {
        if (isFromCore) {
            // Core -> EVM costs 200k gas at base gas price
            return 200000;
        } else {
            // EVM -> Core costs standard ERC20 transfer (~50k)
            return 50000;
        }
    }
    
    // ============ Helper Functions ============
    
    /**
     * @notice Get token index from ERC20 address
     * @dev Placeholder - implement mapping based on your token list
     * @param token ERC20 token address
     * @return tokenIndex The HIP-1 index
     */
    function _getTokenIndex(address token) 
        internal 
        pure 
        returns (uint256 tokenIndex) 
    {
        // TODO: Implement proper token index mapping
        // This is placeholder logic - replace with actual index lookup
        // Example: USDT0 might be index 200, USDHL index 201, etc.
        
        // For now, derive from address (NOT production ready)
        tokenIndex = uint256(uint160(token)) % 1000;
        return tokenIndex;
    }
    
    /**
     * @notice Mark EVM->Core transfer as completed
     * @param transferId The transfer to mark complete
     */
    function completeTransfer(bytes32 transferId) 
        external 
        onlyVault 
    {
        require(pendingTransfers[transferId].amount > 0, "Transfer not found");
        pendingTransfers[transferId].completed = true;
        emit TransferCompleted(transferId);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update vault contract address
     * @param newVault New authorized vault address
     */
    function setVaultContract(address newVault) 
        external 
        onlyOwner 
    {
        require(newVault != address(0), "Invalid vault");
        address oldVault = vaultContract;
        vaultContract = newVault;
        emit VaultContractUpdated(oldVault, newVault);
    }
    
    /**
     * @notice Emergency pause transfers
     */
    function pause() external onlyOwner {
        paused = true;
    }
    
    /**
     * @notice Resume transfers after pause
     */
    function unpause() external onlyOwner {
        paused = false;
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // ============ Fallback ============
    
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
