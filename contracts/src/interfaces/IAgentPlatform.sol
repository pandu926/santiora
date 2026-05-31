// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title Somnia Agent Platform Interface
/// @dev Platform: 0x7407cb35a17D511D1Bd32dD726ADb8D5344ECbE3 (testnet)

enum ConsensusType { Majority, Threshold }
enum ResponseStatus { None, Pending, Success, Failed, TimedOut }

struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;
    uint256 timestamp;
    uint256 executionCost;
}

struct Request {
    uint256 id;
    address requester;
    address callbackAddress;
    bytes4 callbackSelector;
    address[] subcommittee;
    Response[] responses;
    uint256 responseCount;
    uint256 failureCount;
    uint256 threshold;
    uint256 createdAt;
    uint256 deadline;
    ResponseStatus status;
    ConsensusType consensusType;
    uint256 remainingBudget;
    uint256 perAgentBudget;
}

interface IAgentRequester {
    function createRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload
    ) external payable returns (uint256 requestId);

    function createAdvancedRequest(
        uint256 agentId,
        address callbackAddress,
        bytes4 callbackSelector,
        bytes calldata payload,
        uint256 subcommitteeSize,
        uint256 threshold,
        ConsensusType consensusType,
        uint256 timeout
    ) external payable returns (uint256 requestId);

    function getRequestDeposit() external view returns (uint256);
}

/// @dev Agent method interfaces for selector generation
interface ILLMAgent {
    function inferNumber(string memory prompt, string memory system, int256 minValue, int256 maxValue, bool chainOfThought) external returns (int256);
    function inferString(string memory prompt, string memory system, bool chainOfThought, string[] memory allowedValues) external returns (string memory);
    function inferChat(string[] memory roles, string[] memory messages, bool chainOfThought) external returns (string memory);
}

interface IJsonApiAgent {
    function fetchUint(string memory url, string memory selector, uint8 decimals) external returns (uint256);
    function fetchString(string memory url, string memory selector) external returns (string memory);
}

interface IWebScraperAgent {
    function ExtractString(string memory key, string memory description, string[] memory options, string memory prompt, string memory url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external returns (string memory);
    function ExtractANumber(string memory key, string memory description, uint256 min, uint256 max, string memory prompt, string memory url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external returns (uint256);
}

interface IParseWebsiteAgent {
    function ExtractString(string memory key, string memory description, string[] memory options, string memory prompt, string memory url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external returns (string memory);
    function ExtractANumber(string memory key, string memory description, uint256 min, uint256 max, string memory prompt, string memory url, bool resolveUrl, uint8 numPages, uint8 confidenceThreshold) external returns (uint256);
}

/// @dev inferToolsChat — multi-step reasoning with onchain tool execution
interface IToolsAgent {
    function inferToolsChat(
        string[] memory roles,
        string[] memory messages,
        string[] memory mcpServerUrls,
        OnchainTool[] memory onchainTools,
        uint256 maxIterations,
        bool chainOfThought
    ) external returns (
        string memory finishReason,
        string memory response,
        string[] memory updatedRoles,
        string[] memory updatedMessages,
        string[] memory pendingToolCallIds,
        bytes[] memory pendingToolCalls
    );
}

struct OnchainTool {
    string a;
    string b;
}

/// @dev Reactive precompile interface (0x0100)
interface ISomniaReactive {
    function subscribe(
        address emitter,
        bytes32 eventSignature,
        address handler,
        bytes4 handlerSelector
    ) external returns (uint256 subscriptionId);

    function unsubscribe(uint256 subscriptionId) external;
}
