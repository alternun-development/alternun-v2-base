// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IGBTToken.sol";
import "../interfaces/ITreasuryManager.sol";
import "../interfaces/IPriceOracle.sol";

contract GBTMinter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IGBTToken public gbtToken;
    ITreasuryManager public treasury;
    IPriceOracle public oracle;
    IERC20 public stablecoin;
    uint8 public stablecoinDecimals;
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public feeBps;
    uint256 public commercialFactorBps;
    
    uint256 public constant W_INFERRED = 1500;
    uint256 public constant W_INDICATED = 3000;
    uint256 public constant W_MEASURED = 6000;
    uint256 public constant W_PROBABLE = 5000;
    uint256 public constant W_PROVEN = 7000;
    
    struct Reserves {
        uint256 inferred;
        uint256 indicated;
        uint256 measured;
        uint256 probable;
        uint256 proven;
    }
    
    Reserves public totalReserves;
    uint256 public totalMinted;
    uint256 public totalFeesCollected;
    
    event GBTMinted(address indexed user, uint256 stablecoinAmount, uint256 gbtAmount, uint256 feeAmount, uint256 goldPrice);
    event ReservesUpdated(uint256 inferred, uint256 indicated, uint256 measured, uint256 probable, uint256 proven, uint256 newCapacity);
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
        require(_feeBps <= 1000, "Minter: fee too high");
        require(_commercialFactorBps <= BPS_DENOMINATOR, "Minter: factor too high");
        
        gbtToken = IGBTToken(_gbtToken);
        treasury = ITreasuryManager(_treasury);
        oracle = IPriceOracle(_oracle);
        stablecoin = IERC20(_stablecoin);
        
        // Get stablecoin decimals (6 for USDT, 18 for DAI, etc)
        (bool success, bytes memory data) = _stablecoin.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success && data.length > 0, "Minter: failed to get decimals");
        stablecoinDecimals = abi.decode(data, (uint8));
        
        feeBps = _feeBps;
        commercialFactorBps = _commercialFactorBps;
    }
    
    function mint(uint256 stablecoinAmount) external nonReentrant returns (uint256 gbtAmount) {
        require(stablecoinAmount > 0, "Minter: amount must be > 0");
        
        uint256 goldPrice = oracle.getGoldPrice();
        require(goldPrice > 0, "Minter: invalid gold price");
        
        uint256 feeAmount = (stablecoinAmount * feeBps) / BPS_DENOMINATOR;
        uint256 netStablecoin = stablecoinAmount - feeAmount;
        
        // Calculate GBT amount
        // netStablecoin has stablecoinDecimals (6 for USDT)
        // goldPrice has 7 decimals
        // Result should have 7 decimals (GBT decimals)
        // Formula: (netStablecoin * 10^7) / goldPrice
        // But we need to normalize stablecoin to 7 decimals first
        uint256 normalizedStablecoin;
        if (stablecoinDecimals < 7) {
            // Scale up (e.g., USDT 6 decimals -> 7 decimals)
            normalizedStablecoin = netStablecoin * (10 ** (7 - stablecoinDecimals));
        } else if (stablecoinDecimals > 7) {
            // Scale down (e.g., DAI 18 decimals -> 7 decimals)
            normalizedStablecoin = netStablecoin / (10 ** (stablecoinDecimals - 7));
        } else {
            normalizedStablecoin = netStablecoin;
        }
        
        // Now both are in 7 decimals
        gbtAmount = (normalizedStablecoin * 1e7) / goldPrice;
        
        // Minimum 1 gram = 1 * 10^7 token units
        require(gbtAmount >= 1e7, "Minter: below minimum");
        
        uint256 capacity = calculateCapacity();
        require(totalMinted + gbtAmount <= capacity, "Minter: exceeds capacity");
        
        stablecoin.safeTransferFrom(msg.sender, address(this), stablecoinAmount);
        stablecoin.approve(address(treasury), netStablecoin);
        treasury.receiveFunds(netStablecoin);
        
        totalFeesCollected += feeAmount;
        
        gbtToken.mint(msg.sender, gbtAmount);
        totalMinted += gbtAmount;
        
        emit GBTMinted(msg.sender, stablecoinAmount, gbtAmount, feeAmount, goldPrice);
        
        return gbtAmount;
    }
    
    function previewMint(uint256 stablecoinAmount) 
        external 
        view 
        returns (uint256 gbtAmount, uint256 feeAmount, uint256 goldPrice) 
    {
        goldPrice = oracle.getGoldPrice();
        feeAmount = (stablecoinAmount * feeBps) / BPS_DENOMINATOR;
        uint256 netStablecoin = stablecoinAmount - feeAmount;
        
        uint256 normalizedStablecoin;
        if (stablecoinDecimals < 7) {
            normalizedStablecoin = netStablecoin * (10 ** (7 - stablecoinDecimals));
        } else if (stablecoinDecimals > 7) {
            normalizedStablecoin = netStablecoin / (10 ** (stablecoinDecimals - 7));
        } else {
            normalizedStablecoin = netStablecoin;
        }
        
        gbtAmount = (normalizedStablecoin * 1e7) / goldPrice;
        
        return (gbtAmount, feeAmount, goldPrice);
    }
    
    function calculateCapacity() public view returns (uint256 capacity) {
        uint256 weightedSum = 
            (totalReserves.inferred * W_INFERRED) +
            (totalReserves.indicated * W_INDICATED) +
            (totalReserves.measured * W_MEASURED) +
            (totalReserves.probable * W_PROBABLE) +
            (totalReserves.proven * W_PROVEN);
        
        capacity = (weightedSum * commercialFactorBps * 1e7) / (BPS_DENOMINATOR * BPS_DENOMINATOR);
        
        return capacity;
    }
    
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
    
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Minter: fee too high");
        emit ParameterUpdated("feeBps", feeBps, newFeeBps);
        feeBps = newFeeBps;
    }
    
    function setCommercialFactorBps(uint256 newFactorBps) external onlyOwner {
        require(newFactorBps <= BPS_DENOMINATOR, "Minter: factor too high");
        emit ParameterUpdated("commercialFactorBps", commercialFactorBps, newFactorBps);
        commercialFactorBps = newFactorBps;
    }
    
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Minter: oracle cannot be zero");
        oracle = IPriceOracle(newOracle);
    }
    
    function withdrawFees(address to) external onlyOwner {
        require(to != address(0), "Minter: recipient cannot be zero");
        uint256 amount = stablecoin.balanceOf(address(this));
        require(amount > 0, "Minter: no fees to withdraw");
        
        stablecoin.safeTransfer(to, amount);
    }
    
    function getRemainingCapacity() external view returns (uint256 remaining) {
        uint256 capacity = calculateCapacity();
        if (capacity > totalMinted) {
            return capacity - totalMinted;
        }
        return 0;
    }
}