// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockDeBridgeGate {
    function send(
        address,
        uint256,
        uint256,
        bytes memory,
        bytes memory,
        bool,
        uint32,
        bytes calldata
    ) external payable {
        require(msg.value >= 0.001 ether, "Insufficient fee");
    }
    
    function globalFixedNativeFee() external pure returns (uint256) {
        return 0.001 ether;
    }
    
    function getChainFee(uint256) external pure returns (uint256) {
        return 0.0005 ether;
    }
}
