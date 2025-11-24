// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IGBTToken.sol";
import "../interfaces/ITreasuryManager.sol";
import "../interfaces/IPriceOracle.sol";

/**
 * @title GBTMinter
 * @notice Handles minting of GBT tokens based on verified gold reserves
 * @dev Implements NI 43-101 reserve categorization and weighted capacity
 * 
 * Reserve Categories (NI 43-101):
 * - Proven Reserves: 70% weight (7,000 bps)
 * - Probable Reserves: 50% weight (5,000 bps)
 * - Measured Resources: 60% weight (6,000 bps)
 * - Indicated Resources: 30% weight (3,000 bps)
 * - Inferred Resources: 15% weight (1,500 bps)
 */
contract GBTMinter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice GBT token contract
    IGBTToken public gbtToken;
    
    /// @notice Treasury manager contract
    ITreasuryManager public treasury;
    
    /// @notice Price oracle for gold/USD
    IPriceOracle public oracle;
    
    /// @notice Accepted stablecoin for payment
    IERC20 public stablecoin;
    
    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Minting fee in basis points (200 = 2%)
    uint256 public feeBps;
    
    /// @notice Commercial factor in basis points (8000 = 80%)
    uint256 public commercialFactorBps;
    
    /// @notice Minimum mint amount in grams (scaled by 1000)
    uint256 public constant MIN_MINT_GRAMS = 1000; // 1 gram
    
    /// @notice Reserve category weights (basis points)
    uint256 public constant W_INFERRED = 1500;    // 15%
    uint256 public constant W_INDICATED = 3000;   // 30%
    uint256 public constant W_MEASURED = 6000;    // 60%
    uint256 public constant W_PROBABLE = 5000;    // 50%
    uint256 public constant W_PROVEN = 7000;      // 70%
    
    /// @notice Reserve data structure
    struct Reserves {
        uint256 inferred;    // grams * 1000
        uint256 indicated;   // grams * 1000
        uint256 measured;    // grams * 1000
        uint256 probable;    // grams * 1000
        uint256 proven;      // grams * 1000
    }
    
    /// @notice Total reserves by category
    Reserves public totalReserves;
    
    /// @notice Total GBT minted (in token units, 7 decimals)
    uint256 public totalMinted;
    
    /// @notice Total fees collected (in stablecoin)
    uint256 public totalFeesCollected;
    
    /// @notice Emitted when GBT is minted
    event GBTMinted(
        address indexed user,
        uint256 stablecoinAmount,
        uint256 gbtAmount,
        uint256 feeAmount,
        uint256 goldPrice
    );
    
    /// @notice Emitted when reserves are updated
    event ReservesUpdated(
        uint256 inferred,
        uint256 indicated,
        uint256 measured,
        uint256 probable,
        uint256 proven,
        uint256 newCapacity
    );
    
    /// @notice Emitted when parameters are updated
    event ParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    
    constructor(
        address _gbtToken,
        address _treasury,
        address _oracle,
        address _stablecoin,
        uint256 _feeBps,
        uint256 _commercialFactorBps,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_gbtToken != address(0), "Minter: GBT cannot be zero");
        require(_treasury != address(0), "Minter: treasury cannot be zero");
        require(_oracle != address(0), "Minter: oracle cannot be zero");
        require(_stablecoin != address(0), "Minter: stablecoin cannot be zero");
        require(_feeBps <= 1000, "Minter: fee too high"); // Max 10%
        require(_commercialFactorBps <= BPS_DENOMINATOR, "Minter: factor too high");
        
        gbtToken = IGBTToken(_gbtToken);
        treasury = ITreasuryManager(_treasury);
        oracle = IPriceOracle(_oracle);
        stablecoin = IERC20(_stablecoin);
        feeBps = _feeBps;
        commercialFactorBps = _commercialFactorBps;
    }
    
    /**
     * @notice Mint GBT by depositing stablecoins
     * @param stablecoinAmount Amount of stablecoins to deposit (with stablecoin decimals)
     * @return gbtAmount Amount of GBT tokens minted (7 decimals)
     */
    function mint(uint256 stablecoinAmount) external nonReentrant returns (uint256 gbtAmount) {
        require(stablecoinAmount > 0, "Minter: amount must be > 0");
        
        // Get current gold price from oracle (USD per gram, 7 decimals)
        uint256 goldPrice = oracle.getGoldPrice();
        require(goldPrice > 0, "Minter: invalid gold price");
        
        // Calculate fee
        uint256 feeAmount = (stablecoinAmount * feeBps) / BPS_DENOMINATOR;
        uint256 netStablecoin = stablecoinAmount - feeAmount;
        
        // Calculate GBT output
        // Formula: (netStablecoin * 1000) / goldPrice
        // This gives us grams * 1000 (3 decimals scale)
        uint256 gramsScaled = (netStablecoin * 1000 * (10 ** 7)) / goldPrice;
        
        // Check minimum mint
        require(gramsScaled >= MIN_MINT_GRAMS, "Minter: below minimum");
        
        // Convert to token units (7 decimals)
        // grams * 1000 * 10000 = token units
        gbtAmount = gramsScaled * 10000;
        
        // Check capacity
        uint256 capacity = calculateCapacity();
        require(totalMinted + gbtAmount <= capacity, "Minter: exceeds capacity");
        
        // Transfer stablecoins from user
        stablecoin.safeTransferFrom(msg.sender, address(this), stablecoinAmount);
        
        // Send net amount to treasury (treasury will distribute)
        stablecoin.approve(address(treasury), netStablecoin);
        treasury.receiveFunds(netStablecoin);
        
        // Fees stay in minter contract (can be withdrawn by owner)
        totalFeesCollected += feeAmount;
        
        // Mint GBT to user
        gbtToken.mint(msg.sender, gbtAmount);
        totalMinted += gbtAmount;
        
        emit GBTMinted(msg.sender, stablecoinAmount, gbtAmount, feeAmount, goldPrice);
        
        return gbtAmount;
    }
    
    /**
     * @notice Calculate preview of GBT output for given stablecoin input
     * @param stablecoinAmount Input amount
     * @return gbtAmount Expected GBT output
     * @return feeAmount Fee amount
     * @return goldPrice Current gold price
     */
    function previewMint(uint256 stablecoinAmount) 
        external 
        view 
        returns (
            uint256 gbtAmount,
            uint256 feeAmount,
            uint256 goldPrice
        ) 
    {
        goldPrice = oracle.getGoldPrice();
        feeAmount = (stablecoinAmount * feeBps) / BPS_DENOMINATOR;
        uint256 netStablecoin = stablecoinAmount - feeAmount;
        
        uint256 gramsScaled = (netStablecoin * 1000 * (10 ** 7)) / goldPrice;
        gbtAmount = gramsScaled * 10000;
        
        return (gbtAmount, feeAmount, goldPrice);
    }
    
    /**
     * @notice Calculate total mintable capacity based on reserves
     * @return capacity Total capacity in token units (7 decimals)
     * @dev Formula: S(reserves * weight * commercialFactor) / (10000 * 10000)
     */
    function calculateCapacity() public view returns (uint256 capacity) {
        // Calculate weighted sum in basis points
        uint256 weightedSum = 
            (totalReserves.inferred * W_INFERRED) +
            (totalReserves.indicated * W_INDICATED) +
            (totalReserves.measured * W_MEASURED) +
            (totalReserves.probable * W_PROBABLE) +
            (totalReserves.proven * W_PROVEN);
        
        // Apply commercial factor and convert to token units
        // weightedSum is in (grams * 1000) * bps
        // Divide by BPS_DENOMINATOR twice (once for weights, once for commercial factor)
        // Then multiply by 10000 to get token units (7 decimals)
        capacity = (weightedSum * commercialFactorBps * 10000) / (BPS_DENOMINATOR * BPS_DENOMINATOR);
        
        return capacity;
    }
    
    /**
     * @notice Update reserve quantities
     * @param _reserves New reserve amounts (grams * 1000)
     * @dev Only callable by owner (admin who verifies NI 43-101 reports)
     */
    function updateReserves(Reserves calldata _reserves) external onlyOwner {
        totalReserves = _reserves;
        
        uint256 newCapacity = calculateCapacity();
        
        emit ReservesUpdated(
            _reserves.inferred,
            _reserves.indicated,
            _reserves.measured,
            _reserves.probable,
            _reserves.proven,
            newCapacity
        );
    }
    
    /**
     * @notice Update minting fee
     * @param newFeeBps New fee in basis points
     */
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Minter: fee too high"); // Max 10%
        emit ParameterUpdated("feeBps", feeBps, newFeeBps);
        feeBps = newFeeBps;
    }
    
    /**
     * @notice Update commercial factor
     * @param newFactorBps New factor in basis points
     */
    function setCommercialFactorBps(uint256 newFactorBps) external onlyOwner {
        require(newFactorBps <= BPS_DENOMINATOR, "Minter: factor too high");
        emit ParameterUpdated("commercialFactorBps", commercialFactorBps, newFactorBps);
        commercialFactorBps = newFactorBps;
    }
    
    /**
     * @notice Update oracle address
     * @param newOracle New oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Minter: oracle cannot be zero");
        oracle = IPriceOracle(newOracle);
    }
    
    /**
     * @notice Withdraw collected fees
     * @param to Recipient address
     */
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Minter: recipient cannot be zero");
        uint256 amount = stablecoin.balanceOf(address(this));
        require(amount > 0, "Minter: no fees to withdraw");
        
        stablecoin.safeTransfer(to, amount);
    }
    
    /**
     * @notice Get remaining mintable capacity
     * @return remaining Remaining capacity in token units
     */
    function getRemainingCapacity() external view returns (uint256 remaining) {
        uint256 capacity = calculateCapacity();
        if (capacity > totalMinted) {
            return capacity - totalMinted;
        }
        return 0;
    }
}