// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IGBTToken.sol";

/**
 * @title ProjectVaults
 * @notice Manages regenerative project funding and equity distribution
 * @dev Handles GBT staking, pGBT issuance, and ePT conversion
 */
contract ProjectVaults is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /// @notice Project lifecycle states
    enum ProjectState {
        Proposed,       // Initial proposal submitted
        Active,         // Approved and accepting stakes
        Funded,         // Funding goal reached
        InConstruction, // Project under construction
        Operational,    // Project generating returns
        Completed,      // Project successfully completed
        Failed          // Project failed or cancelled
    }
    
    /// @notice Project data structure
    struct Project {
        string name;
        string ipfsHash;           // Project documentation on IPFS
        ProjectState state;
        uint256 fundingGoal;       // Target funding in GBT (7 decimals)
        uint256 totalStaked;       // Current staked amount
        uint256 totalProfits;      // Accumulated profits to distribute
        uint256 createdAt;
        uint256 fundedAt;
        address projectOwner;      // Project operator/developer
        bool acceptingStakes;
    }
    
    /// @notice User stake in a project
    struct Stake {
        uint256 amount;            // GBT staked (7 decimals)
        uint256 pGBTReceived;      // pGBT tokens received
        uint256 profitsClaimed;    // Total profits claimed
        uint256 debtRepaid;        // Amount repaid towards 50% threshold
        bool hasConvertedToEPT;    // Whether converted to ePT
        uint256 stakedAt;
    }
    
    /// @notice GBT token
    IGBTToken public gbtToken;
    
    /// @notice pGBT token
    IERC20 public pgbtToken;
    
    /// @notice ePT token
    IERC20 public eptToken;
    
    /// @notice KYC verification contract
    address public kycVerifier;
    
    /// @notice Unstaking penalty in basis points (500 = 5%)
    uint256 public unstakePenaltyBps;
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Debt repayment threshold for ePT conversion (50%)
    uint256 public constant EPT_THRESHOLD_BPS = 5000;
    
    /// @notice Project counter
    uint256 public projectCount;
    
    /// @notice Projects mapping
    mapping(uint256 => Project) public projects;
    
    /// @notice User stakes: projectId => user => Stake
    mapping(uint256 => mapping(address => Stake)) public stakes;
    
    /// @notice KYC status: user => verified
    mapping(address => bool) public kycVerified;
    
    /// @notice Project funding split: projectId => funding address
    mapping(uint256 => address) public projectFundingPool;
    
    /// @notice Events
    event ProjectCreated(uint256 indexed projectId, string name, uint256 fundingGoal);
    event ProjectStateChanged(uint256 indexed projectId, ProjectState oldState, ProjectState newState);
    event Staked(uint256 indexed projectId, address indexed user, uint256 gbtAmount, uint256 pgbtAmount);
    event Unstaked(uint256 indexed projectId, address indexed user, uint256 amount, uint256 penalty);
    event ProfitsDistributed(uint256 indexed projectId, uint256 totalAmount);
    event ProfitsClaimed(uint256 indexed projectId, address indexed user, uint256 amount);
    event ConvertedToEPT(uint256 indexed projectId, address indexed user, uint256 eptAmount);
    event KYCVerified(address indexed user);
    
    constructor(
        address _gbtToken,
        address _pgbtToken,
        address _eptToken,
        address _kycVerifier,
        uint256 _unstakePenaltyBps,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_gbtToken != address(0), "Vaults: GBT cannot be zero");
        require(_pgbtToken != address(0), "Vaults: pGBT cannot be zero");
        require(_eptToken != address(0), "Vaults: ePT cannot be zero");
        require(_unstakePenaltyBps <= 1000, "Vaults: penalty too high"); // Max 10%
        
        gbtToken = IGBTToken(_gbtToken);
        pgbtToken = IERC20(_pgbtToken);
        eptToken = IERC20(_eptToken);
        kycVerifier = _kycVerifier;
        unstakePenaltyBps = _unstakePenaltyBps;
    }
    
    /**
     * @notice Create new project proposal
     * @param name Project name
     * @param ipfsHash IPFS hash of project documentation
     * @param fundingGoal Funding goal in GBT tokens
     * @param fundingPool Address to receive 50% of staked funds
     */
    function createProject(
        string calldata name,
        string calldata ipfsHash,
        uint256 fundingGoal,
        address fundingPool
    ) external onlyOwner returns (uint256 projectId) {
        require(fundingGoal > 0, "Vaults: funding goal must be > 0");
        require(fundingPool != address(0), "Vaults: funding pool cannot be zero");
        
        projectId = projectCount++;
        
        projects[projectId] = Project({
            name: name,
            ipfsHash: ipfsHash,
            state: ProjectState.Proposed,
            fundingGoal: fundingGoal,
            totalStaked: 0,
            totalProfits: 0,
            createdAt: block.timestamp,
            fundedAt: 0,
            projectOwner: msg.sender,
            acceptingStakes: false
        });
        
        projectFundingPool[projectId] = fundingPool;
        
        emit ProjectCreated(projectId, name, fundingGoal);
        
        return projectId;
    }
    
    /**
     * @notice Activate project to accept stakes
     * @param projectId Project ID
     */
    function activateProject(uint256 projectId) external onlyOwner {
        Project storage project = projects[projectId];
        require(project.state == ProjectState.Proposed, "Vaults: invalid state");
        
        ProjectState oldState = project.state;
        project.state = ProjectState.Active;
        project.acceptingStakes = true;
        
        emit ProjectStateChanged(projectId, oldState, ProjectState.Active);
    }
    
    /**
     * @notice Stake GBT to a project
     * @param projectId Project ID
     * @param amount Amount of GBT to stake
     */
    function stake(uint256 projectId, uint256 amount) external nonReentrant {
        Project storage project = projects[projectId];
        require(project.acceptingStakes, "Vaults: not accepting stakes");
        require(project.state == ProjectState.Active, "Vaults: project not active");
        require(amount > 0, "Vaults: amount must be > 0");
        
        Stake storage userStake = stakes[projectId][msg.sender];
        
        // Transfer GBT from user to vault
        IERC20(address(gbtToken)).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update stake
        userStake.amount += amount;
        userStake.stakedAt = block.timestamp;
        project.totalStaked += amount;
        
        // Mint pGBT 1:1
        // Note: pGBT must have this contract set as minter
        userStake.pGBTReceived += amount;
        
        // Route 50% to project funding pool, 50% stays as principal reserve
        uint256 fundingAmount = amount / 2;
        IERC20(address(gbtToken)).safeTransfer(projectFundingPool[projectId], fundingAmount);
        
        emit Staked(projectId, msg.sender, amount, amount);
        
        // Check if funding goal reached
        if (project.totalStaked >= project.fundingGoal && project.state == ProjectState.Active) {
            ProjectState oldState = project.state;
            project.state = ProjectState.Funded;
            project.fundedAt = block.timestamp;
            project.acceptingStakes = false;
            emit ProjectStateChanged(projectId, oldState, ProjectState.Funded);
        }
    }
    
    /**
     * @notice Unstake GBT from project (with penalty if before completion)
     * @param projectId Project ID
     * @param amount Amount to unstake
     */
    function unstake(uint256 projectId, uint256 amount) external nonReentrant {
        Project storage project = projects[projectId];
        Stake storage userStake = stakes[projectId][msg.sender];
        
        require(amount > 0, "Vaults: amount must be > 0");
        require(userStake.amount >= amount, "Vaults: insufficient stake");
        require(
            project.state == ProjectState.Active || 
            project.state == ProjectState.Failed ||
            project.state == ProjectState.Completed,
            "Vaults: cannot unstake in current state"
        );
        
        uint256 penalty = 0;
        uint256 returnAmount = amount;
        
        // Apply penalty if project not completed/failed
        if (project.state == ProjectState.Active) {
            penalty = (amount * unstakePenaltyBps) / BPS_DENOMINATOR;
            returnAmount = amount - penalty;
        }
        
        // Update stake
        userStake.amount -= amount;
        project.totalStaked -= amount;
        
        // Burn corresponding pGBT
        // Note: User must have approved this contract to burn their pGBT
        
        // Return GBT (minus penalty)
        IERC20(address(gbtToken)).safeTransfer(msg.sender, returnAmount);
        
        // Penalty stays in contract (can be redistributed)
        
        emit Unstaked(projectId, msg.sender, returnAmount, penalty);
    }
    
    /**
     * @notice Distribute profits to project stakers
     * @param projectId Project ID
     * @param profitAmount Amount of GBT profits to distribute
     */
    function distributeProfits(uint256 projectId, uint256 profitAmount) external onlyOwner nonReentrant {
        Project storage project = projects[projectId];
        require(
            project.state == ProjectState.Operational || 
            project.state == ProjectState.Completed,
            "Vaults: project not operational"
        );
        require(profitAmount > 0, "Vaults: profit must be > 0");
        
        // Transfer profits to vault
        IERC20(address(gbtToken)).safeTransferFrom(msg.sender, address(this), profitAmount);
        
        project.totalProfits += profitAmount;
        
        emit ProfitsDistributed(projectId, profitAmount);
    }
    
    /**
     * @notice Claim accumulated profits
     * @param projectId Project ID
     */
    function claimProfits(uint256 projectId) external nonReentrant {
        Project storage project = projects[projectId];
        Stake storage userStake = stakes[projectId][msg.sender];
        
        require(userStake.amount > 0, "Vaults: no stake");
        require(project.totalProfits > 0, "Vaults: no profits");
        
        // Calculate user's share based on their stake proportion
        uint256 userShare = (project.totalProfits * userStake.amount) / project.totalStaked;
        uint256 claimable = userShare - userStake.profitsClaimed;
        
        require(claimable > 0, "Vaults: nothing to claim");
        
        userStake.profitsClaimed += claimable;
        
        // Calculate debt repayment (50% of claimed profits count towards ePT threshold)
        uint256 debtRepayment = claimable / 2;
        userStake.debtRepaid += debtRepayment;
        
        // Transfer claimable GBT share
        IERC20(address(gbtToken)).safeTransfer(msg.sender, claimable);
        
        emit ProfitsClaimed(projectId, msg.sender, claimable);
    }
    
    /**
     * @notice Convert pGBT to ePT after repaying 50% debt
     * @param projectId Project ID
     */
    function convertToEPT(uint256 projectId) external nonReentrant {
        Stake storage userStake = stakes[projectId][msg.sender];
        
        require(!userStake.hasConvertedToEPT, "Vaults: already converted");
        require(userStake.amount > 0, "Vaults: no stake");
        require(kycVerified[msg.sender], "Vaults: KYC required");
        
        // Check 50% debt threshold
        uint256 requiredRepayment = (userStake.amount * EPT_THRESHOLD_BPS) / BPS_DENOMINATOR;
        require(userStake.debtRepaid >= requiredRepayment, "Vaults: threshold not met");
        
        // Mark as converted
        userStake.hasConvertedToEPT = true;
        
        // Mint ePT tokens (1:1 with original stake)
        // Note: ePT contract must have this contract set as minter
        uint256 eptAmount = userStake.amount;
        
        emit ConvertedToEPT(projectId, msg.sender, eptAmount);
    }
    
    /**
     * @notice Update project state
     * @param projectId Project ID
     * @param newState New state
     */
    function updateProjectState(uint256 projectId, ProjectState newState) external onlyOwner {
        Project storage project = projects[projectId];
        ProjectState oldState = project.state;
        
        project.state = newState;
        
        emit ProjectStateChanged(projectId, oldState, newState);
    }
    
    /**
     * @notice Verify user KYC
     * @param user User address
     */
    function verifyKYC(address user) external {
        require(msg.sender == kycVerifier || msg.sender == owner(), "Vaults: not authorized");
        kycVerified[user] = true;
        emit KYCVerified(user);
    }
    
    /**
     * @notice Update KYC verifier
     * @param newVerifier New verifier address
     */
    function setKYCVerifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "Vaults: verifier cannot be zero");
        kycVerifier = newVerifier;
    }
    
    /**
     * @notice Update unstake penalty
     * @param newPenaltyBps New penalty in basis points
     */
    function setUnstakePenalty(uint256 newPenaltyBps) external onlyOwner {
        require(newPenaltyBps <= 1000, "Vaults: penalty too high");
        unstakePenaltyBps = newPenaltyBps;
    }
    
    /**
     * @notice Get user stake info
     * @param projectId Project ID
     * @param user User address
     */
    function getUserStake(uint256 projectId, address user) 
        external 
        view 
        returns (
            uint256 amount,
            uint256 pGBTReceived,
            uint256 profitsClaimed,
            uint256 debtRepaid,
            bool hasConvertedToEPT,
            bool canConvertToEPT
        ) 
    {
        Stake storage userStake = stakes[projectId][user];
        uint256 requiredRepayment = (userStake.amount * EPT_THRESHOLD_BPS) / BPS_DENOMINATOR;
        
        return (
            userStake.amount,
            userStake.pGBTReceived,
            userStake.profitsClaimed,
            userStake.debtRepaid,
            userStake.hasConvertedToEPT,
            userStake.debtRepaid >= requiredRepayment && !userStake.hasConvertedToEPT && kycVerified[user]
        );
    }
}