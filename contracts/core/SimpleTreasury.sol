// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleTreasury is Ownable {
    IERC20 public treasuryToken;
    address public projectPool;
    address public recoveryPool;
    address public alternunTreasury;

    event FundsReceived(uint256 amount, uint256 toProjects, uint256 toRecovery, uint256 toAlternun);

    constructor(
        address _treasuryToken,
        address _projectPool,
        address _recoveryPool,
        address _alternunTreasury,
        address _owner
    ) Ownable(_owner) {
        require(_treasuryToken != address(0), "Treasury: invalid token");
        require(_projectPool != address(0), "Treasury: invalid project pool");
        require(_recoveryPool != address(0), "Treasury: invalid recovery pool");
        require(_alternunTreasury != address(0), "Treasury: invalid alternun treasury");

        treasuryToken = IERC20(_treasuryToken);
        projectPool = _projectPool;
        recoveryPool = _recoveryPool;
        alternunTreasury = _alternunTreasury;
    }

    function receiveFunds(uint256 amount) external {
        require(amount > 0, "Treasury: amount must be > 0");

        uint256 toProjects = (amount * 50) / 100;
        uint256 toRecovery = (amount * 30) / 100;
        uint256 toAlternun = amount - toProjects - toRecovery;

        require(
            treasuryToken.transferFrom(msg.sender, projectPool, toProjects),
            "Treasury: project transfer failed"
        );
        require(
            treasuryToken.transferFrom(msg.sender, recoveryPool, toRecovery),
            "Treasury: recovery transfer failed"
        );
        require(
            treasuryToken.transferFrom(msg.sender, alternunTreasury, toAlternun),
            "Treasury: alternun transfer failed"
        );

        emit FundsReceived(amount, toProjects, toRecovery, toAlternun);
    }

    function updateTreasuryToken(address newToken) external onlyOwner {
        require(newToken != address(0), "Treasury: invalid token");
        treasuryToken = IERC20(newToken);
    }

    function updateProjectPool(address newPool) external onlyOwner {
        require(newPool != address(0), "Treasury: invalid address");
        projectPool = newPool;
    }

    function updateRecoveryPool(address newPool) external onlyOwner {
        require(newPool != address(0), "Treasury: invalid address");
        recoveryPool = newPool;
    }

    function updateAlternunTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury: invalid address");
        alternunTreasury = newTreasury;
    }
}