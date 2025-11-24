// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TreasuryManager
 * @notice Manages protocol treasury and fund distribution
 * @dev Upgradeable contract to support USDT -> xAUT migration
 * 
 * Fund Distribution:
 * - 50% -> Projects Pool
 * - 30% -> Recovery Pool
 * - 20% -> Alternun Treasury (includes 8% mine owner royalties)
 */
contract TreasuryManager is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    
    /// @notice Current treasury token (USDT initially, xAUT later)
    IERC20 public treasuryToken;
    
    /// @notice Project pool address (receives 50%)
    address public projectPool;
    
    /// @notice Recovery pool address (receives 30%)
    address public recoveryPool;
    
    /// @notice Alternun treasury address (receives 20%)
    address public alternunTreasury;
    
    /// @notice Basis points for percentage calculations (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Projects allocation (50%)
    uint256 public constant PROJECTS_BPS = 5000;
    
    /// @notice Recovery pool allocation (30%)
    uint256 public constant RECOVERY_BPS = 3000;
    
    /// @notice Alternun treasury allocation (20%)
    uint256 public constant ALTERNUN_BPS = 2000;
    
    /// @notice Total funds received
    uint256 public totalReceived;
    
    /// @notice Total funds distributed
    uint256 public totalDistributed;
    
    /// @notice Emitted when funds are received
    event FundsReceived(address indexed from, uint256 amount, uint256 timestamp);
    
    /// @notice Emitted when funds are distributed
    event FundsDistributed(
        uint256 projectsAmount,
        uint256 recoveryAmount,
        uint256 alternunAmount,
        uint256 timestamp
    );
    
    /// @notice Emitted when treasury token is updated
    event TreasuryTokenUpdated(address indexed oldToken, address indexed newToken);
    
    /// @notice Emitted when pool addresses are updated
    event PoolAddressUpdated(string indexed poolName, address indexed oldAddress, address indexed newAddress);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _treasuryToken Initial treasury token address (USDT)
     * @param _projectPool Project pool address
     * @param _recoveryPool Recovery pool address
     * @param _alternunTreasury Alternun treasury address
     * @param initialOwner Contract owner address
     */
    function initialize(
        address _treasuryToken,
        address _projectPool,
        address _recoveryPool,
        address _alternunTreasury,
        address initialOwner
    ) public initializer {
        require(_treasuryToken != address(0), "Treasury: token cannot be zero");
        require(_projectPool != address(0), "Treasury: project pool cannot be zero");
        require(_recoveryPool != address(0), "Treasury: recovery pool cannot be zero");
        require(_alternunTreasury != address(0), "Treasury: alternun treasury cannot be zero");
        
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        treasuryToken = IERC20(_treasuryToken);
        projectPool = _projectPool;
        recoveryPool = _recoveryPool;
        alternunTreasury = _alternunTreasury;
    }
    
    /**
     * @notice Receive and distribute funds according to 50/30/20 split
     * @param amount Amount of treasury tokens to distribute
     * @dev Called by minter contract after receiving stablecoin payment
     */
    function receiveFunds(uint256 amount) external nonReentrant {
        require(amount > 0, "Treasury: amount must be greater than 0");
        
        // Transfer tokens from sender (minter contract)
        treasuryToken.safeTransferFrom(msg.sender, address(this), amount);
        
        totalReceived += amount;
        
        emit FundsReceived(msg.sender, amount, block.timestamp);
        
        // Distribute immediately
        _distributeFunds(amount);
    }
    
    /**
     * @notice Internal function to distribute funds
     * @param amount Amount to distribute
     */
    function _distributeFunds(uint256 amount) internal {
        // Calculate allocations
        uint256 projectsAmount = (amount * PROJECTS_BPS) / BPS_DENOMINATOR;
        uint256 recoveryAmount = (amount * RECOVERY_BPS) / BPS_DENOMINATOR;
        uint256 alternunAmount = (amount * ALTERNUN_BPS) / BPS_DENOMINATOR;
        
        // Handle rounding - any dust goes to projects
        uint256 distributed = projectsAmount + recoveryAmount + alternunAmount;
        if (distributed < amount) {
            projectsAmount += (amount - distributed);
        }
        
        // Transfer to respective pools
        treasuryToken.safeTransfer(projectPool, projectsAmount);
        treasuryToken.safeTransfer(recoveryPool, recoveryAmount);
        treasuryToken.safeTransfer(alternunTreasury, alternunAmount);
        
        totalDistributed += amount;
        
        emit FundsDistributed(projectsAmount, recoveryAmount, alternunAmount, block.timestamp);
    }
    
    /**
     * @notice Update treasury token (for USDT -> xAUT migration)
     * @param newToken New treasury token address
     * @dev Only callable by owner, requires balance to be 0
     */
    function updateTreasuryToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Treasury: new token cannot be zero");
        require(treasuryToken.balanceOf(address(this)) == 0, "Treasury: must have zero balance");
        
        address oldToken = address(treasuryToken);
        treasuryToken = IERC20(newToken);
        
        emit TreasuryTokenUpdated(oldToken, newToken);
    }
    
    /**
     * @notice Update project pool address
     * @param newPool New project pool address
     */
    function updateProjectPool(address newPool) external onlyOwner {
        require(newPool != address(0), "Treasury: pool cannot be zero");
        address oldPool = projectPool;
        projectPool = newPool;
        emit PoolAddressUpdated("project", oldPool, newPool);
    }
    
    /**
     * @notice Update recovery pool address
     * @param newPool New recovery pool address
     */
    function updateRecoveryPool(address newPool) external onlyOwner {
        require(newPool != address(0), "Treasury: pool cannot be zero");
        address oldPool = recoveryPool;
        recoveryPool = newPool;
        emit PoolAddressUpdated("recovery", oldPool, newPool);
    }
    
    /**
     * @notice Update Alternun treasury address
     * @param newTreasury New Alternun treasury address
     */
    function updateAlternunTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury: treasury cannot be zero");
        address oldTreasury = alternunTreasury;
        alternunTreasury = newTreasury;
        emit PoolAddressUpdated("alternun", oldTreasury, newTreasury);
    }
    
    /**
     * @notice Emergency withdrawal function
     * @param token Token to withdraw
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @dev Only callable by owner, for emergency situations
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Treasury: recipient cannot be zero");
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @notice Get current treasury balance
     * @return Current balance of treasury token
     */
    function getBalance() external view returns (uint256) {
        return treasuryToken.balanceOf(address(this));
    }
    
    /**
     * @notice Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[50] private __gap;
}