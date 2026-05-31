// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title Treasury
/// @notice Protocol treasury — AI-managed fund allocation for seeding markets
/// @dev No admin. Only Agent Platform can allocate funds.
contract Treasury {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    address public immutable factory;
    uint256 public totalAllocated;
    uint256 public totalCollectedFees;

    mapping(address => uint256) public marketAllocations;

    event FundsAllocated(address indexed market, uint256 amount);
    event FeesCollected(address indexed market, uint256 amount);
    event FundsDeposited(address indexed from, uint256 amount);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM_ADDRESS, "Only Agent Platform");
        _;
    }

    constructor(address _factory) {
        factory = _factory;
    }

    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    /// @notice Allocate funds to seed a market — ONLY via AI agent
    function allocateToMarket(address market, uint256 amount) external onlyPlatform {
        require(address(this).balance >= amount, "Insufficient treasury");
        marketAllocations[market] += amount;
        totalAllocated += amount;

        (bool sent, ) = market.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsAllocated(market, amount);
    }

    /// @notice Collect fees from a market — ONLY via AI agent
    function collectFees(address market, uint256 amount) external onlyPlatform {
        totalCollectedFees += amount;
        emit FeesCollected(market, amount);
    }

    /// @notice Get available balance (not yet allocated)
    function availableBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get treasury stats
    function getStats() external view returns (uint256 balance, uint256 allocated, uint256 fees) {
        return (address(this).balance, totalAllocated, totalCollectedFees);
    }
}
