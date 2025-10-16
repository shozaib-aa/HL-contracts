// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract MockVault {
    address public asset;
    mapping(address => uint256) public shares;
    mapping(address => mapping(address => uint256)) public allowances;
    
    constructor(address _asset) {
        asset = _asset;
    }
    
    function deposit(uint256 amount, address depositor) external {
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        shares[depositor] += amount;
    }
    
    function withdraw(uint256 shareAmount, address recipient) external returns (uint256) {
        require(allowances[recipient][msg.sender] >= shareAmount || msg.sender == recipient, "Not approved");
        require(shares[recipient] >= shareAmount, "Insufficient shares");
        
        shares[recipient] -= shareAmount;
        if (msg.sender != recipient) {
            allowances[recipient][msg.sender] -= shareAmount;
        }
        
        IERC20(asset).transfer(msg.sender, shareAmount);
        return shareAmount;
    }
    
    function convertToAssets(uint256 shareAmount) external pure returns (uint256) {
        return shareAmount; // 1:1 for testing
    }
    
    function mintShares(address to, uint256 amount) external {
        shares[to] += amount;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
}
