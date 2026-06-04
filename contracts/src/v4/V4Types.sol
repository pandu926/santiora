// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// V4Types - Shared types, constants, and events for SantioraV4

// ===============================================================================
// PLATFORM CONSTANTS
// ===============================================================================

address constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
uint256 constant JSON_AGENT_ID = 13174292974160097713;
uint256 constant LLM_AGENT_ID = 12847293847561029384;
uint256 constant SCRAPER_AGENT_ID = 12875401142070969085;

uint256 constant JSON_DEPOSIT = 0.12 ether;
uint256 constant LLM_DEPOSIT = 0.33 ether;
uint256 constant SCRAPER_DEPOSIT = 0.33 ether;

uint256 constant MAX_ROUNDS = 3;
uint256 constant VOTE_QUORUM = 3;
uint256 constant VOTE_THRESHOLD = 2;
uint256 constant MIN_DATA_LENGTH = 30;
uint256 constant MAX_FIELD_LENGTH = 600;

// ===============================================================================
// ENUMS
// ===============================================================================

enum MarketStatus { Creating, Active, Resolving, Resolved, Failed }

enum RequestPhase {
    None,
    CreateGather,    // data gathering for market creation
    CreateVote,      // voting on data sufficiency for creation
    CreateFinal,     // LLM creates market question
    ResolveGather,   // data gathering for resolution
    ResolveVote,     // voting on data sufficiency for resolution
    ResolveFinal     // LLM resolves market outcome
}

// ===============================================================================
// STRUCTS
// ===============================================================================

struct Rules {
    uint256 scanInterval;
    uint256 minMarketDuration;
    uint256 maxMarketDuration;
    uint256 maxMarketsPerDay;
    uint256 confidenceThreshold;
    uint8 maxRounds;
}

struct RulesState {
    uint256 lastScanTimestamp;
    uint256 marketsCreatedToday;
    uint256 dayStartTimestamp;
}

struct Performance {
    uint256 totalCreated;
    uint256 totalResolved;
    uint256 totalFailed;
    uint256 totalRejected;
    uint256 totalConfidenceSum;
}

struct Market {
    string question;
    uint256 odds;
    uint256 deadline;
    string category;
    MarketStatus status;
    string outcome;
    uint256 confidence;
    uint256 createdAt;
    // Deep research state
    ResearchState research;
    // Source continuity (create saves, resolve re-fetches)
    SourceInfo source;
}

struct ResearchState {
    uint8 round;
    string dataContext;
    uint8 sourcesPending;
    uint8 votesYes;
    uint8 votesNo;
    uint8 votesPending;
    string missingHints;
}

struct SourceInfo {
    string url;
    string selector;
    string leagueId;
    string data;
}

// ===============================================================================
// DATA SOURCE CONFIG
// ===============================================================================

struct DataQuery {
    string label;
    string url;
    string selector;
}

// ===============================================================================
// EVENTS
// ===============================================================================

event MarketCreating(uint256 indexed marketId, string category);
event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
event MarketResolving(uint256 indexed marketId);
event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence);
event PipelineFailed(uint256 indexed marketId, string reason);

event DataGathered(uint256 indexed marketId, uint8 round, string label, uint8 status, uint256 chars);
event DataFeedback(uint256 indexed marketId, uint8 round, string message);
event VoteResult(uint256 indexed marketId, uint8 round, uint8 yes, uint8 no, string verdict);
event ResearchLoop(uint256 indexed marketId, uint8 nextRound, string reason);
event Decision(uint256 indexed marketId, string action, string detail);
