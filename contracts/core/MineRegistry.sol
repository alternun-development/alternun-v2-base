// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MineRegistry
 * @notice Registry for mine metadata and NI 43-101 reports
 */
contract MineRegistry is Ownable {
    struct MineMetadata {
        string name;
        string country;
        string municipality;
        string location;
        string notes;
        bool isActive;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct NI43101Report {
        string ipfsHash;
        uint256 reportDate;
        string reportNumber;
        uint256 timestamp;
        // Reserves at time of this report
        uint256 inferred;
        uint256 indicated;
        uint256 measured;
        uint256 probable;
        uint256 proven;
    }

    // Mine ID => Metadata
    mapping(uint256 => MineMetadata) public mines;
    
    // Mine ID => Array of NI 43-101 reports
    mapping(uint256 => NI43101Report[]) public mineReports;
    
    // Total number of mines registered
    uint256 public mineCount;

    // Events
    event MineRegistered(
        uint256 indexed mineId,
        string name,
        string country,
        string municipality
    );
    
    event MineUpdated(uint256 indexed mineId, uint256 timestamp);
    
    event NI43101Added(
        uint256 indexed mineId,
        string ipfsHash,
        uint256 reportDate,
        string reportNumber
    );

    constructor(address _owner) Ownable(_owner) {}

    /**
     * @notice Register a new mine
     */
    function registerMine(
        string memory _name,
        string memory _country,
        string memory _municipality,
        string memory _location,
        string memory _notes
    ) external onlyOwner returns (uint256) {
        uint256 mineId = mineCount;
        
        mines[mineId] = MineMetadata({
            name: _name,
            country: _country,
            municipality: _municipality,
            location: _location,
            notes: _notes,
            isActive: true,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        mineCount++;

        emit MineRegistered(mineId, _name, _country, _municipality);
        
        return mineId;
    }

    /**
     * @notice Update mine metadata
     */
    function updateMineMetadata(
        uint256 _mineId,
        string memory _name,
        string memory _country,
        string memory _municipality,
        string memory _location,
        string memory _notes
    ) external onlyOwner {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        
        MineMetadata storage mine = mines[_mineId];
        mine.name = _name;
        mine.country = _country;
        mine.municipality = _municipality;
        mine.location = _location;
        mine.notes = _notes;
        mine.lastUpdated = block.timestamp;

        emit MineUpdated(_mineId, block.timestamp);
    }

    /**
     * @notice Add NI 43-101 report to a mine
     */
    function addNI43101Report(
        uint256 _mineId,
        string memory _ipfsHash,
        uint256 _reportDate,
        string memory _reportNumber,
        uint256 _inferred,
        uint256 _indicated,
        uint256 _measured,
        uint256 _probable,
        uint256 _proven
    ) external onlyOwner {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        require(bytes(_ipfsHash).length > 0, "MineRegistry: invalid IPFS hash");
        
        mineReports[_mineId].push(NI43101Report({
            ipfsHash: _ipfsHash,
            reportDate: _reportDate,
            reportNumber: _reportNumber,
            timestamp: block.timestamp,
            inferred: _inferred,
            indicated: _indicated,
            measured: _measured,
            probable: _probable,
            proven: _proven
        }));

        mines[_mineId].lastUpdated = block.timestamp;

        emit NI43101Added(_mineId, _ipfsHash, _reportDate, _reportNumber);
    }

    /**
     * @notice Get mine metadata
     */
    function getMine(uint256 _mineId) external view returns (MineMetadata memory) {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        return mines[_mineId];
    }

    /**
     * @notice Get all NI 43-101 reports for a mine
     */
    function getMineReports(uint256 _mineId) external view returns (NI43101Report[] memory) {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        return mineReports[_mineId];
    }

    /**
     * @notice Get latest NI 43-101 report for a mine
     */
    function getLatestReport(uint256 _mineId) external view returns (NI43101Report memory) {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        NI43101Report[] storage reports = mineReports[_mineId];
        require(reports.length > 0, "MineRegistry: no reports for this mine");
        return reports[reports.length - 1];
    }

    /**
     * @notice Get total reserves from latest report
     */
    function getLatestReserves(uint256 _mineId) external view returns (
        uint256 inferred,
        uint256 indicated,
        uint256 measured,
        uint256 probable,
        uint256 proven
    ) {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        NI43101Report[] storage reports = mineReports[_mineId];
        require(reports.length > 0, "MineRegistry: no reports for this mine");
        
        NI43101Report storage latest = reports[reports.length - 1];
        return (
            latest.inferred,
            latest.indicated,
            latest.measured,
            latest.probable,
            latest.proven
        );
    }

    /**
     * @notice Get number of reports for a mine
     */
    function getReportCount(uint256 _mineId) external view returns (uint256) {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        return mineReports[_mineId].length;
    }

    /**
     * @notice Toggle mine active status
     */
    function setMineActive(uint256 _mineId, bool _isActive) external onlyOwner {
        require(_mineId < mineCount, "MineRegistry: mine does not exist");
        mines[_mineId].isActive = _isActive;
        mines[_mineId].lastUpdated = block.timestamp;
        emit MineUpdated(_mineId, block.timestamp);
    }
}