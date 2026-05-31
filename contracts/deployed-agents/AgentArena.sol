// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title AgentArena
/// @notice Darwinian AI competition — multiple AI agents compete to create the best markets
/// @dev Agents earn reputation based on market performance. Bad agents get auto-retired.
///      Best agents get more treasury allocation.
contract AgentArena {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    uint256 public constant MIN_REPUTATION = 20;
    uint256 public constant INITIAL_REPUTATION = 50;

    struct AgentProfile {
        uint256 id;
        string name;
        uint256 marketsCreated;
        uint256 totalVolume;
        uint256 correctResolutions;
        uint256 totalResolutions;
        uint256 reputationScore;
        uint256 treasuryAllocation;
        bool isActive;
        uint256 registeredAt;
    }

    AgentProfile[] public agents;
    mapping(address => uint256) public marketCreator;

    // Events
    event AgentRegistered(uint256 indexed agentId, string name);
    event MarketCreatedBy(uint256 indexed agentId, address indexed market);
    event ResolutionRecorded(uint256 indexed agentId, address indexed market, bool wasCorrect, uint256 newReputation);
    event AgentRetired(uint256 indexed agentId, uint256 reputationScore);
    event VolumeRecorded(uint256 indexed agentId, uint256 volume, uint256 newReputation);
    event TreasuryReallocated(uint256 indexed agentId, uint256 newAllocation);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM_ADDRESS, "Only Agent Platform");
        _;
    }

    receive() external payable {}

    // =========================================================================
    // Agent Registration
    // =========================================================================

    /// @notice Register a new AI agent strategy in the arena
    /// @param name Human-readable name for the agent strategy
    /// @return agentId The ID assigned to the new agent
    function registerAgent(string calldata name) external returns (uint256 agentId) {
        agentId = agents.length;

        agents.push(AgentProfile({
            id: agentId,
            name: name,
            marketsCreated: 0,
            totalVolume: 0,
            correctResolutions: 0,
            totalResolutions: 0,
            reputationScore: INITIAL_REPUTATION,
            treasuryAllocation: 0,
            isActive: true,
            registeredAt: block.timestamp
        }));

        emit AgentRegistered(agentId, name);
    }

    // =========================================================================
    // Performance Recording (Platform-only)
    // =========================================================================

    /// @notice Record that an agent created a market
    /// @param agentId The agent that created the market
    /// @param market The address of the created market
    function recordMarketCreation(uint256 agentId, address market) external onlyPlatform {
        require(agentId < agents.length, "Agent does not exist");
        require(agents[agentId].isActive, "Agent is retired");

        agents[agentId].marketsCreated++;
        marketCreator[market] = agentId;

        emit MarketCreatedBy(agentId, market);
    }

    /// @notice Record a market resolution outcome for an agent
    /// @param agentId The agent whose market was resolved
    /// @param market The market address that was resolved
    /// @param wasCorrect Whether the agent's prediction/resolution was correct
    function recordResolution(uint256 agentId, address market, bool wasCorrect) external onlyPlatform {
        require(agentId < agents.length, "Agent does not exist");

        AgentProfile storage agent = agents[agentId];
        agent.totalResolutions++;

        if (wasCorrect) {
            agent.correctResolutions++;
        }

        uint256 newReputation = _calculateReputation(agentId);
        agent.reputationScore = newReputation;

        if (newReputation < MIN_REPUTATION && agent.isActive) {
            agent.isActive = false;
            emit AgentRetired(agentId, newReputation);
        }

        emit ResolutionRecorded(agentId, market, wasCorrect, newReputation);
    }

    /// @notice Record volume attracted by an agent's markets
    /// @param agentId The agent whose markets attracted volume
    /// @param volume The volume amount to add
    function recordVolume(uint256 agentId, uint256 volume) external onlyPlatform {
        require(agentId < agents.length, "Agent does not exist");

        agents[agentId].totalVolume += volume;

        uint256 newReputation = _calculateReputation(agentId);
        agents[agentId].reputationScore = newReputation;

        emit VolumeRecorded(agentId, volume, newReputation);
    }

    // =========================================================================
    // Treasury Management (Platform-only)
    // =========================================================================

    /// @notice Distribute treasury budget proportional to reputation among active agents
    /// @param totalBudget The total STT budget to distribute
    function reallocateTreasury(uint256 totalBudget) external onlyPlatform {
        uint256 totalReputation = 0;
        uint256 agentCount = agents.length;

        // Sum reputation of active agents
        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].isActive) {
                totalReputation += agents[i].reputationScore;
            }
        }

        if (totalReputation == 0) {
            return;
        }

        // Distribute proportionally
        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].isActive) {
                uint256 allocation = (totalBudget * agents[i].reputationScore) / totalReputation;
                agents[i].treasuryAllocation = allocation;
                emit TreasuryReallocated(i, allocation);
            } else {
                agents[i].treasuryAllocation = 0;
            }
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get the full leaderboard of all agents
    /// @return All agent profiles (frontend can sort by reputationScore)
    function getLeaderboard() external view returns (AgentProfile[] memory) {
        return agents;
    }

    /// @notice Get only active (non-retired) agents
    /// @return activeAgents Array of active agent profiles
    function getActiveAgents() external view returns (AgentProfile[] memory) {
        uint256 activeCount = 0;
        uint256 agentCount = agents.length;

        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].isActive) {
                activeCount++;
            }
        }

        AgentProfile[] memory activeAgents = new AgentProfile[](activeCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].isActive) {
                activeAgents[idx] = agents[i];
                idx++;
            }
        }

        return activeAgents;
    }

    /// @notice Get stats for a specific agent
    /// @param agentId The agent to query
    /// @return The agent's full profile
    function getAgentStats(uint256 agentId) external view returns (AgentProfile memory) {
        require(agentId < agents.length, "Agent does not exist");
        return agents[agentId];
    }

    /// @notice Get total number of registered agents
    /// @return The count of all agents (active and retired)
    function getAgentCount() external view returns (uint256) {
        return agents.length;
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /// @dev Calculate reputation score weighted by accuracy and volume
    ///      Formula: (correctResolutions * 100 / totalResolutions) weighted by volume factor
    ///      Volume factor: min(totalVolume / 1 ether, 100) adds up to +10 bonus points
    function _calculateReputation(uint256 agentId) internal view returns (uint256) {
        AgentProfile storage agent = agents[agentId];

        if (agent.totalResolutions == 0) {
            return INITIAL_REPUTATION;
        }

        // Base accuracy score: 0-100
        uint256 accuracyScore = (agent.correctResolutions * 100) / agent.totalResolutions;

        // Volume bonus: up to 10 extra points based on volume attracted
        // 1 ether of volume = 1 bonus point, capped at 10
        uint256 volumeBonus = agent.totalVolume / 1 ether;
        if (volumeBonus > 10) {
            volumeBonus = 10;
        }

        // Final reputation: accuracy (0-100) + volume bonus (0-10), capped at 100
        uint256 reputation = accuracyScore + volumeBonus;
        if (reputation > 100) {
            reputation = 100;
        }

        return reputation;
    }
}
