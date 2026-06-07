// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

address constant PLATFORM_ADDR = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
uint256 constant JSON_AGENT_ID = 13174292974160097713;
uint256 constant LLM_AGENT_ID = 12847293847561029384;

uint256 constant SUBCOMMITTEE_SIZE = 3;
uint256 constant PER_AGENT_COST = 70000000000000000; // 0.07 STT per runner

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

uint256 constant MAX_ITERATIONS = 3;
uint8 constant MAX_TOOLS_PER_YIELD = 5;
uint256 constant MIN_CONFIDENCE = 70;
uint256 constant MAX_DEADLINE_DAYS = 7;
uint256 constant MIN_DEADLINE_DAYS = 1;
uint256 constant MAX_FIELD_LENGTH = 600;

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

enum MarketStatus { Creating, Active, Resolving, Resolved, Failed }

enum Phase {
    Idle,
    Orchestrating,
    ExecutingTools,
    Resuming,
    Done
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/// @notice Market data — stored permanently on-chain
struct Market {
    string question;
    uint256 odds;
    uint256 deadline;
    string category;
    MarketStatus status;
    string outcome;
    uint256 confidence;
    uint256 createdAt;
    string sourceUrl;
    string rawResponse;
}

/// @notice Transient pipeline state — deleted after market reaches Done
struct PipelineState {
    Phase phase;
    uint8 iteration;
    uint8 totalPendingTools;
    uint8 completedTools;
    bool isResolve;
    string[] savedRoles;
    string[] savedMessages;
    string[] toolCallIds;
    string[] toolResults;
    uint256[] toolRequestIds;
}

/// @notice Protocol operational rules
struct Rules {
    uint256 balanceMinimum;      // min contract balance to create (default: 1 STT)
    uint256 confidenceThreshold; // min confidence for resolution (default: 70)
}

/// @notice Lifetime performance stats
struct Performance {
    uint256 totalCreated;
    uint256 totalResolved;
    uint256 totalFailed;
    uint256 totalRejected;   // low confidence rejections
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRY INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface IV5Registry {
    function registerMarket(
        address creator,
        string calldata question,
        uint256 odds,
        uint256 deadline,
        string calldata category
    ) external returns (uint256 registryId);

    function updateMarket(
        address creator,
        uint256 registryId,
        uint8 status,
        string calldata outcome,
        uint256 confidence
    ) external;

    function isDuplicate(string calldata question) external view returns (bool);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

event MarketCreating(uint256 indexed marketId, string category);
event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
event MarketResolving(uint256 indexed marketId);
event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence);
event MarketRejected(uint256 indexed marketId, string reason);
event PipelineFailed(uint256 indexed marketId, string reason);

event ToolYielded(uint256 indexed marketId, uint8 iteration, uint8 toolCount);
event ToolExecuted(uint256 indexed marketId, string toolCallId, string result);
event ResumeTriggered(uint256 indexed marketId, uint8 iteration);

event OwnershipTransferred(address indexed previous, address indexed current);
event Withdrawn(address indexed to, uint256 amount);
event RulesUpdated(uint256 balanceMinimum, uint256 confidenceThreshold);
event ReactiveContractSet(address indexed reactive);
event RegistrySet(address indexed registry);
