// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryManager {
    function receiveFunds(uint256 amount) external;
    function getBalance() external view returns (uint256);
}