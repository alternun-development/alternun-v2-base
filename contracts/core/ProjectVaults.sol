// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../tokens/PGBTToken.sol";
import "../tokens/EPTToken.sol";

contract ProjectVaults is Ownable {
    IERC20 public gbtToken;
    PGBTToken public pgbtToken;
    EPTToken public eptToken;

    enum ProjectState {
        Proposed,
        Active,
        Funded,
        InConstruction,
        Operational,
        Completed,
        Failed
    }

    struct Project {
        string name;
        string ipfsHash;
        ProjectState state;
        uint256 fundingGoal;
        uint256 stakingUnit; // Minimum staking amount in GBT (7 decimals)
        uint256 totalStaked;
        uint256 totalProfits;
        uint256 createdAt;
        uint256 fundedAt;
        address projectOwner;
        address fundingPool;
        bool acceptingStakes;
    }

    struct UserStake {
        uint256 gbtAmount;
        uint256 pGBTUnits; // Number of pGBT units (ERC-1155)
        uint256 profitsClaimed;
        uint256 debtRepaid;
        bool hasConvertedToEPT;
        bool canConvertToEPT;
    }

    uint256 public projectCount;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(address => UserStake)) public userStakes;

    event ProjectCreated(
        uint256 indexed projectId,
        string name,
        uint256 fundingGoal,
        uint256 stakingUnit
    );
    event ProjectActivated(uint256 indexed projectId);
    event Staked(
        uint256 indexed projectId,
        address indexed user,
        uint256 gbtAmount,
        uint256 pGBTUnits
    );
    event Unstaked(
        uint256 indexed projectId,
        address indexed user,
        uint256 gbtAmount,
        uint256 pGBTUnits
    );
    event ProfitsClaimed(
        uint256 indexed projectId,
        address indexed user,
        uint256 amount
    );
    event ConvertedToEPT(
        uint256 indexed projectId,
        address indexed user,
        uint256 eptAmount
    );

    constructor(
        address _gbtToken,
        address _pgbtToken,
        address _eptToken,
        address _owner
    ) Ownable(_owner) {
        require(_gbtToken != address(0), "Invalid GBT token");
        require(_pgbtToken != address(0), "Invalid pGBT token");
        require(_eptToken != address(0), "Invalid ePT token");

        gbtToken = IERC20(_gbtToken);
        pgbtToken = PGBTToken(_pgbtToken);
        eptToken = EPTToken(_eptToken);
    }

    /**
     * @notice Create a new project
     */
    function createProject(
        string memory _name,
        string memory _ipfsHash,
        uint256 _fundingGoal,
        uint256 _stakingUnit,
        address _fundingPool
    ) external onlyOwner returns (uint256) {
        require(_fundingGoal > 0, "Invalid funding goal");
        require(_stakingUnit > 0, "Invalid staking unit");
        require(_fundingPool != address(0), "Invalid funding pool");

        uint256 projectId = projectCount;

        projects[projectId] = Project({
            name: _name,
            ipfsHash: _ipfsHash,
            state: ProjectState.Proposed,
            fundingGoal: _fundingGoal,
            stakingUnit: _stakingUnit,
            totalStaked: 0,
            totalProfits: 0,
            createdAt: block.timestamp,
            fundedAt: 0,
            projectOwner: msg.sender,
            fundingPool: _fundingPool,
            acceptingStakes: false
        });

        // Set metadata in pGBT contract
        pgbtToken.setProjectMetadata(projectId, _name, _ipfsHash, _stakingUnit);

        projectCount++;

        emit ProjectCreated(projectId, _name, _fundingGoal, _stakingUnit);

        return projectId;
    }

    /**
     * @notice Activate a project to accept stakes
     */
    function activateProject(uint256 _projectId) external onlyOwner {
        require(_projectId < projectCount, "Project does not exist");
        Project storage project = projects[_projectId];
        require(
            project.state == ProjectState.Proposed,
            "Project must be in Proposed state"
        );

        project.state = ProjectState.Active;
        project.acceptingStakes = true;

        emit ProjectActivated(_projectId);
    }

    /**
     * @notice Stake GBT in a project
     */
    function stake(uint256 _projectId, uint256 _gbtAmount) external {
        require(_projectId < projectCount, "Project does not exist");
        Project storage project = projects[_projectId];
        
        require(project.acceptingStakes, "Project not accepting stakes");
        require(project.state == ProjectState.Active, "Project not active");
        require(_gbtAmount > 0, "Amount must be > 0");
        
        // CRITICAL: Amount must be exact multiple of staking unit
        require(
            _gbtAmount % project.stakingUnit == 0,
            "Amount must be multiple of staking unit"
        );

        // Calculate pGBT units (1 unit per staking unit)
        uint256 pGBTUnits = _gbtAmount / project.stakingUnit;
        require(pGBTUnits > 0, "Must stake at least 1 unit");

        // Transfer GBT from user
        require(
            gbtToken.transferFrom(msg.sender, address(this), _gbtAmount),
            "GBT transfer failed"
        );

        // Route 50% to project funding pool
        uint256 toFunding = _gbtAmount / 2;
        // 50% kept in reserve

        require(
            gbtToken.transfer(project.fundingPool, toFunding),
            "Funding transfer failed"
        );

        // Update project
        project.totalStaked += _gbtAmount;

        // Check if project reached funding goal
        if (project.totalStaked >= project.fundingGoal) {
            project.state = ProjectState.Funded;
            project.fundedAt = block.timestamp;
            project.acceptingStakes = false;
        }

        // Update user stake
        UserStake storage userStake = userStakes[_projectId][msg.sender];
        userStake.gbtAmount += _gbtAmount;
        userStake.pGBTUnits += pGBTUnits;

        // Mint pGBT (ERC-1155) to user
        pgbtToken.mint(msg.sender, _projectId, pGBTUnits);

        emit Staked(_projectId, msg.sender, _gbtAmount, pGBTUnits);
    }

    /**
     * @notice Unstake GBT from a project (with penalty)
     */
    function unstake(uint256 _projectId, uint256 _pGBTUnits) external {
        require(_projectId < projectCount, "Project does not exist");
        require(_pGBTUnits > 0, "Units must be > 0");

        Project storage project = projects[_projectId];
        UserStake storage userStake = userStakes[_projectId][msg.sender];

        require(userStake.pGBTUnits >= _pGBTUnits, "Insufficient pGBT units");
        require(!userStake.hasConvertedToEPT, "Already converted to ePT");

        // Calculate GBT amount
        uint256 gbtAmount = _pGBTUnits * project.stakingUnit;
        require(userStake.gbtAmount >= gbtAmount, "Insufficient GBT");

        // Apply 10% penalty
        uint256 penalty = gbtAmount / 10;
        uint256 returnAmount = gbtAmount - penalty;

        // Burn pGBT
        pgbtToken.burn(msg.sender, _projectId, _pGBTUnits);

        // Update user stake
        userStake.gbtAmount -= gbtAmount;
        userStake.pGBTUnits -= _pGBTUnits;

        // Update project
        project.totalStaked -= gbtAmount;

        // Return GBT to user (minus penalty)
        require(
            gbtToken.transfer(msg.sender, returnAmount),
            "GBT transfer failed"
        );

        emit Unstaked(_projectId, msg.sender, returnAmount, _pGBTUnits);
    }

    /**
     * @notice Claim profits from a project
     */
    function claimProfits(uint256 _projectId) external {
        require(_projectId < projectCount, "Project does not exist");

        Project storage project = projects[_projectId];
        UserStake storage userStake = userStakes[_projectId][msg.sender];

        require(userStake.gbtAmount > 0, "No stake in project");
        require(project.totalProfits > 0, "No profits available");

        // Calculate user's share of profits
        uint256 userShare = (project.totalProfits * userStake.gbtAmount) /
            project.totalStaked;
        uint256 claimable = userShare - userStake.profitsClaimed;

        require(claimable > 0, "No profits to claim");

        userStake.profitsClaimed += claimable;

        // Transfer GBT profits
        require(
            gbtToken.transfer(msg.sender, claimable),
            "Profit transfer failed"
        );

        emit ProfitsClaimed(_projectId, msg.sender, claimable);
    }

    /**
     * @notice Convert pGBT to ePT (after 50% debt repayment)
     */
    function convertToEPT(uint256 _projectId) external {
        require(_projectId < projectCount, "Project does not exist");

        UserStake storage userStake = userStakes[_projectId][msg.sender];

        require(userStake.pGBTUnits > 0, "No pGBT units");
        require(!userStake.hasConvertedToEPT, "Already converted");
        require(userStake.canConvertToEPT, "Cannot convert yet");

        uint256 eptAmount = userStake.pGBTUnits;

        // Burn all pGBT
        pgbtToken.burn(msg.sender, _projectId, userStake.pGBTUnits);

        // Mint ePT
        eptToken.mint(msg.sender, eptAmount);

        userStake.hasConvertedToEPT = true;

        emit ConvertedToEPT(_projectId, msg.sender, eptAmount);
    }

    /**
     * @notice Get user stake info
     */
    function getUserStake(uint256 _projectId, address _user)
        external
        view
        returns (
            uint256 gbtAmount,
            uint256 pGBTUnits,
            uint256 profitsClaimed,
            uint256 debtRepaid,
            bool hasConvertedToEPT,
            bool canConvertToEPT
        )
    {
        UserStake storage userStake = userStakes[_projectId][_user];
        return (
            userStake.gbtAmount,
            userStake.pGBTUnits,
            userStake.profitsClaimed,
            userStake.debtRepaid,
            userStake.hasConvertedToEPT,
            userStake.canConvertToEPT
        );
    }

    /**
     * @notice Get project info
     */
    function getProject(uint256 _projectId)
        external
        view
        returns (Project memory)
    {
        require(_projectId < projectCount, "Project does not exist");
        return projects[_projectId];
    }

    /**
     * @notice Add profits to a project
     */
    function addProfits(uint256 _projectId, uint256 _amount)
        external
        onlyOwner
    {
        require(_projectId < projectCount, "Project does not exist");
        require(_amount > 0, "Amount must be > 0");

        require(
            gbtToken.transferFrom(msg.sender, address(this), _amount),
            "GBT transfer failed"
        );

        projects[_projectId].totalProfits += _amount;
    }

    /**
     * @notice Update project state
     */
    function updateProjectState(uint256 _projectId, ProjectState _newState)
        external
        onlyOwner
    {
        require(_projectId < projectCount, "Project does not exist");
        projects[_projectId].state = _newState;
    }
}
