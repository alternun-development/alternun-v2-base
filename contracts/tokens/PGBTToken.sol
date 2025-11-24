// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title pGBT - Project Gold-Backed Token
 * @notice Issued when users deposit GBT into a project vault
 * @dev Represents a locked claim on project returns
 */
contract PGBTToken is ERC20, Ownable {
    
    address public minter;
    
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    constructor(address initialOwner) 
        ERC20("Project Gold-Backed Token", "pGBT") 
        Ownable(initialOwner) 
    {}
    
    function decimals() public pure override returns (uint8) {
        return 7;
    }
    
    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "pGBT: minter cannot be zero address");
        address oldMinter = minter;
        minter = newMinter;
        emit MinterUpdated(oldMinter, newMinter);
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "pGBT: caller is not the minter");
        require(to != address(0), "pGBT: mint to zero address");
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