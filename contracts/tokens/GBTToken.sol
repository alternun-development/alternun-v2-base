// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GBT - Gold-Backed Token
 * @notice ERC-20 token representing verified underground gold reserves
 * @dev Uses 7 decimals to represent grams * 10,000
 */
contract GBTToken is ERC20, Ownable {
    
    address public minter;
    
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    constructor(address initialOwner) 
        ERC20("Gold-Backed Token", "GBT") 
        Ownable(initialOwner) 
    {}
    
    function decimals() public pure override returns (uint8) {
        return 7;
    }
    
    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "GBT: minter cannot be zero address");
        address oldMinter = minter;
        minter = newMinter;
        emit MinterUpdated(oldMinter, newMinter);
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "GBT: caller is not the minter");
        require(to != address(0), "GBT: mint to zero address");
        _mint(to, amount);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    function burnFrom(address from, uint256 amount) external {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }
}