// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceOracle
 * @notice Mock oracle for testing - returns configurable gold price
 * @dev In production, this will be replaced with Chainlink oracle
 */
contract MockPriceOracle is Ownable {
    
    /// @notice Current gold price (USD per gram, 7 decimals)
    /// @dev Example: 65.50 USD/gram = 655000000 (65.50 * 10^7)
    uint256 private goldPrice;
    
    /// @notice Emitted when price is updated
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    constructor(uint256 initialPrice, address initialOwner) Ownable(initialOwner) {
        require(initialPrice > 0, "Oracle: price must be > 0");
        goldPrice = initialPrice;
    }
    
    /**
     * @notice Get current gold price
     * @return price USD per gram with 7 decimals
     */
    function getGoldPrice() external view returns (uint256) {
        return goldPrice;
    }
    
    /**
     * @notice Update gold price (only for testing)
     * @param newPrice New price in USD per gram (7 decimals)
     */
    function setGoldPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Oracle: price must be > 0");
        uint256 oldPrice = goldPrice;
        goldPrice = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }
}