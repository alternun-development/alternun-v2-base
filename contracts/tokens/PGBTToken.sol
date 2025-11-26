// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PGBTToken
 * @notice ERC-1155 token representing staked positions in different projects
 * @dev Each project has its own token ID
 */
contract PGBTToken is ERC1155, Ownable {
    string public name = "Project Gold-Backed Token";
    string public symbol = "pGBT";
    
    // Authorized minter (ProjectVaults contract)
    address public minter;
    
    // Project ID => Project metadata
    mapping(uint256 => ProjectMetadata) public projectMetadata;
    
    struct ProjectMetadata {
        string name;
        string ipfsHash;
        uint256 stakingUnit; // in grams (7 decimals)
        bool exists;
    }
    
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event ProjectMetadataSet(uint256 indexed projectId, string name, uint256 stakingUnit);

    constructor(address _owner) ERC1155("") Ownable(_owner) {}

    /**
     * @notice Set the authorized minter (ProjectVaults)
     */
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "PGBTToken: invalid minter");
        address oldMinter = minter;
        minter = _minter;
        emit MinterUpdated(oldMinter, _minter);
    }

    /**
     * @notice Set metadata for a project token
     */
    function setProjectMetadata(
        uint256 _projectId,
        string memory _name,
        string memory _ipfsHash,
        uint256 _stakingUnit
    ) external {
        require(msg.sender == minter || msg.sender == owner(), "PGBTToken: unauthorized");
        
        projectMetadata[_projectId] = ProjectMetadata({
            name: _name,
            ipfsHash: _ipfsHash,
            stakingUnit: _stakingUnit,
            exists: true
        });
        
        emit ProjectMetadataSet(_projectId, _name, _stakingUnit);
    }

    /**
     * @notice Mint pGBT for a user (only minter)
     */
    function mint(
        address _to,
        uint256 _projectId,
        uint256 _amount
    ) external {
        require(msg.sender == minter, "PGBTToken: only minter");
        require(_to != address(0), "PGBTToken: mint to zero address");
        
        _mint(_to, _projectId, _amount, "");
    }

    /**
     * @notice Burn pGBT from a user (only minter)
     */
    function burn(
        address _from,
        uint256 _projectId,
        uint256 _amount
    ) external {
        require(msg.sender == minter, "PGBTToken: only minter");
        
        _burn(_from, _projectId, _amount);
    }

    /**
     * @notice Get metadata for a project
     */
    function getProjectMetadata(uint256 _projectId) 
        external 
        view 
        returns (ProjectMetadata memory) 
    {
        return projectMetadata[_projectId];
    }

    /**
     * @notice Override URI to return project-specific metadata
     */
    function uri(uint256 _projectId) public view override returns (string memory) {
        ProjectMetadata memory metadata = projectMetadata[_projectId];
        if (metadata.exists && bytes(metadata.ipfsHash).length > 0) {
            return string(abi.encodePacked("ipfs://", metadata.ipfsHash));
        }
        return super.uri(_projectId);
    }

    /**
     * @notice Get balance of a user for a specific project
     */
    function balanceOfProject(address _account, uint256 _projectId) 
        external 
        view 
        returns (uint256) 
    {
        return balanceOf(_account, _projectId);
    }

    /**
     * @notice Check if a project token exists
     */
    function projectExists(uint256 _projectId) external view returns (bool) {
        return projectMetadata[_projectId].exists;
    }
}