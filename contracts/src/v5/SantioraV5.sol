// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V5Types.sol";
import "./V5Helpers.sol";
import "./V5Pipeline.sol";

interface IV5Prompts {
    function createMarketPrompt(string calldata category, string calldata date, string calldata existingTopics) external pure returns (string memory);
    function resolveMarketPrompt(string calldata question, string calldata date, string calldata category, string calldata sourceUrl, string calldata odds, string calldata deadline) external pure returns (string memory);
}

/// @title SantioraV5 - Autonomous prediction markets with LLM-as-orchestrator
/// @notice Uses yield & resume pattern: LLM decides what data to fetch,
///         contract executes tools via JSON agent, resumes with results.
/// @dev Inherits V5Pipeline for the state machine. This contract handles
///      market lifecycle, access control, JSON parsing, and registry integration.
contract SantioraV5 is V5Pipeline {
    using V5Helpers for string;

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    address public owner;
    address public reactiveContract;
    IV5Registry public registry;
    IV5Prompts public prompts;

    Market[] public markets;
    Rules public rules;
    Performance public performance;
    string[] public categories;

    mapping(string => uint256) public categorySuccessCount;
    mapping(string => uint256) public categoryFailCount;

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == reactiveContract, "not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(address registryAddr, address promptsAddr) {
        owner = msg.sender;
        require(promptsAddr != address(0), "zero prompts");
        prompts = IV5Prompts(promptsAddr);
        if (registryAddr != address(0)) {
            registry = IV5Registry(registryAddr);
        }
        rules = Rules({
            balanceMinimum: 1 ether,
            confidenceThreshold: MIN_CONFIDENCE
        });
        categories.push("sports");
        categories.push("crypto");
        categories.push("finance");
        categories.push("technology");
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Set the reactive contract that can trigger market creation
    function setReactiveContract(address reactive) external onlyOwner {
        reactiveContract = reactive;
        emit ReactiveContractSet(reactive);
    }

    /// @notice Set the market registry
    function setRegistry(address registryAddr) external onlyOwner {
        registry = IV5Registry(registryAddr);
        emit RegistrySet(registryAddr);
    }

    /// @notice Update operational rules
    function updateRules(Rules calldata newRules) external onlyOwner {
        rules = newRules;
        emit RulesUpdated(newRules.balanceMinimum, newRules.confidenceThreshold);
    }

    /// @notice Update supported categories
    function setCategories(string[] calldata newCategories) external onlyOwner {
        delete categories;
        for (uint256 i = 0; i < newCategories.length; i++) {
            categories.push(newCategories[i]);
        }
    }

    /// @notice Withdraw ETH from the contract
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "insufficient balance");
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(owner, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE MARKET
    // ═══════════════════════════════════════════════════════════════

    /// @notice Create a new prediction market via LLM orchestration
    /// @param category Market category (must be in valid list)
    function createMarket(string calldata category) external onlyAuthorized {
        require(_isValidCategory(category), "invalid category");
        require(address(this).balance >= rules.balanceMinimum, "insufficient balance");

        uint256 marketId = markets.length;
        markets.push();
        Market storage m = markets[marketId];
        m.category = category;
        m.status = MarketStatus.Creating;
        m.createdAt = block.timestamp;

        emit MarketCreating(marketId, category);

        string memory date = V5Helpers.toDateStr(block.timestamp);
        string memory existingTopics = _buildExistingTopics();

        string[] memory roles = new string[](2);
        string[] memory messages = new string[](2);
        roles[0] = "system";
        messages[0] = prompts.createMarketPrompt(category, date, existingTopics);
        roles[1] = "user";
        messages[1] = string(abi.encodePacked(
            "Create a prediction market in the '", category, "' category. ",
            "Fetch real data first, then create a specific market based on what you find. ",
            "Do NOT create a market on any topic already listed above."
        ));

        _dispatchInferToolsChat(marketId, roles, messages, false);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE MARKET
    // ═══════════════════════════════════════════════════════════════

    /// @notice Resolve a market after its deadline has passed
    /// @param marketId The market to resolve
    function resolveMarket(uint256 marketId) external onlyAuthorized {
        require(marketId < markets.length, "invalid marketId");
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active, "not active");
        require(block.timestamp >= m.deadline, "deadline not passed");

        _startResolution(marketId);
    }

    /// @notice Force resolve for testing - bypasses deadline check
    function forceResolve(uint256 marketId) external onlyOwner {
        require(marketId < markets.length, "invalid marketId");
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active, "not active");

        _startResolution(marketId);
    }

    function _startResolution(uint256 marketId) internal {
        Market storage m = markets[marketId];
        m.status = MarketStatus.Resolving;
        emit MarketResolving(marketId);

        string memory date = V5Helpers.toDateStr(block.timestamp);

        string[] memory roles = new string[](2);
        string[] memory messages = new string[](2);
        roles[0] = "system";
        messages[0] = prompts.resolveMarketPrompt(
            m.question, date, m.category, m.sourceUrl,
            V5Helpers.toString(m.odds),
            V5Helpers.toDateStr(m.deadline)
        );
        roles[1] = "user";
        messages[1] = string(abi.encodePacked(
            "Resolve this market NOW. The question was: \"", m.question, "\". ",
            "Fetch the CURRENT data and compare against the threshold."
        ));

        _dispatchInferToolsChat(marketId, roles, messages, true);
    }

    // ═══════════════════════════════════════════════════════════════
    // PIPELINE HOOKS (from V5Pipeline)
    // ═══════════════════════════════════════════════════════════════

    /// @dev Called by pipeline when LLM produces final response
    function _onFinalResponse(uint256 marketId, string memory response) internal override {
        Market storage m = markets[marketId];
        m.rawResponse = response;

        if (m.status == MarketStatus.Creating) {
            _finalizeCreation(marketId, response);
        } else if (m.status == MarketStatus.Resolving) {
            _finalizeResolution(marketId, response);
        }
    }

    /// @dev Called by pipeline on unrecoverable error
    function _onPipelineFailed(uint256 marketId, string memory reason) internal override {
        Market storage m = markets[marketId];
        m.status = MarketStatus.Failed;
        performance.totalFailed++;
        categoryFailCount[m.category]++;
        _cleanupPipeline(marketId);
        emit PipelineFailed(marketId, reason);
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZATION: CREATE
    // ═══════════════════════════════════════════════════════════════

    function _finalizeCreation(uint256 marketId, string memory response) internal {
        Market storage m = markets[marketId];

        string memory question = response.jsonString("question");
        uint256 odds = response.jsonUint("odds");
        string memory sourceUrl = response.jsonString("source_url");

        if (bytes(question).length == 0) {
            _rejectMarket(marketId, "LLM returned no question");
            return;
        }

        // Validate odds
        odds = V5Helpers.bound(odds, 1, 99);

        // Calculate deadline from LLM response
        uint256 deadlineDays = V5Helpers.deadlineDays(response, block.timestamp);
        uint256 deadline = block.timestamp + deadlineDays * 1 days;

        // Check duplicate via registry
        if (address(registry) != address(0)) {
            try registry.isDuplicate(question) returns (bool isDup) {
                if (isDup) {
                    _rejectMarket(marketId, "duplicate market");
                    return;
                }
            } catch {}
        }

        // Store parsed fields
        m.question = V5Helpers.truncate(question, MAX_FIELD_LENGTH);
        m.odds = odds;
        m.deadline = deadline;
        m.sourceUrl = sourceUrl;
        m.status = MarketStatus.Active;

        performance.totalCreated++;
        categorySuccessCount[m.category]++;

        // Register in registry
        if (address(registry) != address(0)) {
            try registry.registerMarket(
                address(this), m.question, m.odds, m.deadline, m.category
            ) {} catch {}
        }

        emit MarketActive(marketId, m.question, m.odds, m.deadline);
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZATION: RESOLVE
    // ═══════════════════════════════════════════════════════════════

    function _finalizeResolution(uint256 marketId, string memory response) internal {
        Market storage m = markets[marketId];

        string memory outcome = response.jsonString("outcome");
        uint256 confidence = response.jsonUint("confidence");

        // Check UNRESOLVABLE
        if (V5Helpers.contains(response, "UNRESOLVABLE")) {
            m.status = MarketStatus.Active;
            performance.totalRejected++;
            emit MarketRejected(marketId, "unresolvable - insufficient data or deadline not passed");
            return;
        }

        // Validate outcome
        if (bytes(outcome).length == 0) {
            m.status = MarketStatus.Active;
            performance.totalRejected++;
            emit MarketRejected(marketId, "no outcome in response");
            return;
        }

        // Enforce confidence threshold
        if (confidence < rules.confidenceThreshold) {
            m.status = MarketStatus.Active;
            performance.totalRejected++;
            emit MarketRejected(marketId, "confidence below threshold");
            return;
        }

        // Accept resolution
        m.outcome = outcome;
        m.confidence = confidence;
        m.status = MarketStatus.Resolved;
        performance.totalResolved++;
        categorySuccessCount[m.category]++;

        // Update registry
        if (address(registry) != address(0)) {
            try registry.updateMarket(
                address(this), marketId, uint8(MarketStatus.Resolved), outcome, confidence
            ) {} catch {}
        }

        emit MarketResolved(marketId, outcome, confidence);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Total number of markets
    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    /// @notice Get performance statistics
    function getStats() external view returns (Performance memory) {
        return performance;
    }

    /// @notice Get supported categories
    function getCategories() external view returns (string[] memory) {
        return categories;
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════

    function _rejectMarket(uint256 marketId, string memory reason) internal {
        markets[marketId].status = MarketStatus.Failed;
        performance.totalRejected++;
        categoryFailCount[markets[marketId].category]++;
        emit MarketRejected(marketId, reason);
    }

    function _isValidCategory(string calldata category) internal view returns (bool) {
        bytes memory catBytes = bytes(category);
        if (catBytes.length == 0 || catBytes.length > 32) return false;
        bytes32 catHash = keccak256(catBytes);
        for (uint256 i = 0; i < categories.length; i++) {
            if (keccak256(bytes(categories[i])) == catHash) return true;
        }
        return false;
    }

    /// @dev Build a compact list of active market questions for the LLM prompt
    function _buildExistingTopics() internal view returns (string memory) {
        uint256 count = 0;
        bytes memory result;
        uint256 total = markets.length;
        // Cap scan at last 20 markets to bound gas
        uint256 start = total > 20 ? total - 20 : 0;
        for (uint256 i = start; i < total; i++) {
            if (markets[i].status == MarketStatus.Active && bytes(markets[i].question).length > 0) {
                if (count > 0) result = abi.encodePacked(result, "\n");
                result = abi.encodePacked(result, "- ", V5Helpers.truncate(markets[i].question, 80));
                count++;
                if (count >= 10) break;
            }
        }
        if (count == 0) return "None yet.";
        return string(result);
    }
}
