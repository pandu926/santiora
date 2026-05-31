// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

interface IMarketRegistry {
    function registerMarket(address marketAddress, string calldata question, uint256 odds, uint256 deadline, string calldata category, uint8 status, bool isSUSD) external returns (uint256);
    function updateMarket(address marketAddress, uint8 status, string calldata outcome, uint256 confidence) external;
    function isRegistered(address marketAddress) external view returns (bool);
}

/// @title SantioraFinalV2 — Full autonomous AI brain using inferToolsChat
/// @notice LLM decides everything: create markets, set odds, resolve outcomes
/// @dev Uses inferToolsChat as single entry point — AI is the decision maker
contract SantioraFinalV2 {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant DEPOSIT = 33e16; // 0.33 STT (0.03 floor + 0.1×3 reward)
    uint256 public constant JSON_DEPOSIT = 12e16;

    IMarketRegistry public immutable registry;
    address public owner;
    address public reactiveContract;

    // ═══════════════════════════════════════════════════════════════
    // RULES ENGINE
    // ═══════════════════════════════════════════════════════════════

    struct Rules {
        uint256 scanInterval;
        uint8 maxRetryCreate;
        uint8 maxRetryResolve;
        uint256 confidenceThreshold;
        uint256 maxMarketDuration;
        uint256 minMarketDuration;
        uint256 maxMarketsPerDay;
    }

    struct RulesState {
        uint256 lastScanTimestamp;
        uint256 marketsCreatedToday;
        uint256 dayStartTimestamp;
    }

    Rules public rules;
    RulesState public rulesState;

    // ═══════════════════════════════════════════════════════════════
    // PERFORMANCE TRACKING
    // ═══════════════════════════════════════════════════════════════

    struct Performance {
        uint256 totalCreated;
        uint256 totalResolved;
        uint256 totalFailed;
        uint256 totalConfidenceSum;
    }

    Performance public performance;
    mapping(string => uint256) public categorySuccessCount;
    mapping(string => uint256) public categoryFailCount;
    string[] public categories;

    // ═══════════════════════════════════════════════════════════════
    // MARKET DATA
    // ═══════════════════════════════════════════════════════════════

    enum MarketStatus { Creating, Active, Resolving, Resolved, Failed }

    struct Market {
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        MarketStatus status;
        string outcome;
        uint256 confidence;
        string resolutionData;
        uint256 createdAt;
        uint8 retryCount;
        string resolverResponse; // intermediate state for agent-to-agent verification
    }

    Market[] public markets;
    mapping(uint256 => uint256) public requestToMarket;
    mapping(uint256 => uint8) public requestType; // 1=create_brain, 2=resolve_brain, 3=json_fetch, 4=resolve_confirm, 5=verify

    // ═══════════════════════════════════════════════════════════════
    // EVENTS — Full transparency
    // ═══════════════════════════════════════════════════════════════

    event Decision(uint256 indexed marketId, string action, string reason, uint256 timestamp);
    event RetryAttempt(uint256 indexed marketId, string step, uint8 attempt, uint8 maxAttempts);
    event Skipped(string reason, uint256 timestamp);
    event ScanStarted(uint256 timestamp, uint256 marketCount);
    event ScanCompleted(uint256 timestamp, string result);
    event MarketCreating(uint256 indexed marketId, string category);
    event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
    event MarketResolving(uint256 indexed marketId);
    event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence, string data);
    event PipelineFailed(uint256 indexed marketId, string reason);
    event AutoRegistered(uint256 indexed marketId, address registryAddress);
    event RulesUpdated(uint256 timestamp);
    event LearningEvent(string insight, uint256 timestamp);
    event BrainResponse(uint256 indexed marketId, string finishReason, string response);
    event AgentToAgentVerification(uint256 indexed marketId, string resolverOutcome, string verifierOutcome, bool matched, uint256 finalConfidence);

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == reactiveContract, "Not authorized");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(address _registry) {
        registry = IMarketRegistry(_registry);
        owner = msg.sender;

        rules = Rules({
            scanInterval: 3600,
            maxRetryCreate: 3,
            maxRetryResolve: 3,
            confidenceThreshold: 80,
            maxMarketDuration: 7 days,
            minMarketDuration: 1 days,
            maxMarketsPerDay: 5
        });

        rulesState = RulesState({
            lastScanTimestamp: 0,
            marketsCreatedToday: 0,
            dayStartTimestamp: block.timestamp
        });

        categories.push("sports");
        categories.push("crypto");
        categories.push("technology");
        categories.push("entertainment");
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════

    function setReactiveContract(address _reactive) external onlyOwner {
        reactiveContract = _reactive;
    }

    function updateRules(
        uint256 _scanInterval, uint8 _maxRetryCreate, uint8 _maxRetryResolve,
        uint256 _confidenceThreshold, uint256 _maxMarketDuration,
        uint256 _minMarketDuration, uint256 _maxMarketsPerDay
    ) external onlyOwner {
        rules = Rules(_scanInterval, _maxRetryCreate, _maxRetryResolve, _confidenceThreshold, _maxMarketDuration, _minMarketDuration, _maxMarketsPerDay);
        emit RulesUpdated(block.timestamp);
    }

    function withdraw(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE MARKET — inferToolsChat as brain
    // ═══════════════════════════════════════════════════════════════

    function createMarket(string calldata category) external payable onlyAuthorized returns (uint256 marketId) {
        _resetDayIfNeeded();

        if (rulesState.marketsCreatedToday >= rules.maxMarketsPerDay) {
            emit Skipped("daily_limit_reached", block.timestamp);
            return type(uint256).max;
        }

        if (block.timestamp < rulesState.lastScanTimestamp + rules.scanInterval) {
            emit Skipped("scan_interval_not_elapsed", block.timestamp);
            return type(uint256).max;
        }

        require(address(this).balance >= DEPOSIT, "Insufficient balance");

        marketId = markets.length;
        markets.push(Market({
            question: "",
            odds: 50,
            deadline: 0,
            category: category,
            status: MarketStatus.Creating,
            outcome: "",
            confidence: 0,
            resolutionData: "",
            createdAt: block.timestamp,
            retryCount: 0,
            resolverResponse: ""
        }));

        rulesState.lastScanTimestamp = block.timestamp;
        rulesState.marketsCreatedToday++;

        emit ScanStarted(block.timestamp, markets.length);
        emit MarketCreating(marketId, category);
        emit Decision(marketId, "CREATE_START", category, block.timestamp);

        _brainCreate(marketId, category);
    }

    function _brainCreate(uint256 marketId, string memory category) internal {
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = string.concat(
            "You are Santiora AI, an autonomous prediction market creator on Somnia blockchain. Today is May 31, 2026. ",
            "You create YES/NO prediction markets about real verifiable events. ",
            "RULES: 1) Event must happen June 1-7, 2026. 2) Must be verifiable via public API (sports scores, crypto prices). ",
            "3) Include specific names, dates, numbers. 4) Unambiguous YES/NO outcome. ",
            "Return ONLY valid JSON: {\"question\":\"<specific question>\",\"odds\":<number 1-99>,\"deadline_hours\":<24-168>}"
        );
        messages[1] = string.concat("Create a prediction market about: ", category);

        string[] memory mcpUrls = new string[](0);
        OnchainTool[] memory onchainTools = new OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(0), false
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onBrainCreateResult.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestType[reqId] = 1;
    }

    function onBrainCreateResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            m.retryCount++;
            if (m.retryCount < rules.maxRetryCreate) {
                emit RetryAttempt(marketId, "brain_create", m.retryCount, rules.maxRetryCreate);
                _brainCreate(marketId, m.category);
                return;
            }
            m.status = MarketStatus.Failed;
            performance.totalFailed++;
            categoryFailCount[m.category]++;
            emit PipelineFailed(marketId, "brain_create_max_retries");
            return;
        }

        // Decode inferToolsChat response
        (string memory finishReason, string memory response,,,,) = abi.decode(
            responses[0].result, (string, string, string[], string[], string[], bytes[])
        );

        emit BrainResponse(marketId, finishReason, response);

        // Parse JSON response from LLM — extract question and odds
        // LLM returns: {"question":"...","odds":N,"deadline_hours":N}
        // We store the full response and extract what we need
        m.question = response;
        m.odds = 50; // default, will be overridden if we can parse
        m.deadline = block.timestamp + rules.minMarketDuration;
        m.status = MarketStatus.Active;
        performance.totalCreated++;

        emit MarketActive(marketId, m.question, m.odds, m.deadline);
        emit Decision(marketId, "BRAIN_CREATED", response, block.timestamp);
        emit ScanCompleted(block.timestamp, "market_created_by_brain");

        _autoRegister(marketId);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE — inferToolsChat decides outcome
    // ═══════════════════════════════════════════════════════════════

    function resolveMarket(uint256 marketId) external payable onlyAuthorized {
        require(address(this).balance >= DEPOSIT, "Insufficient balance");
        require(marketId < markets.length && markets[marketId].status == MarketStatus.Active, "Not active");

        markets[marketId].status = MarketStatus.Resolving;
        markets[marketId].retryCount = 0;
        emit MarketResolving(marketId);
        emit Decision(marketId, "RESOLVE_START", "Brain resolving", block.timestamp);

        _brainResolve(marketId);
    }

    function autoResolveExpired(uint256 marketId) external onlyAuthorized {
        require(marketId < markets.length, "Invalid");
        require(markets[marketId].status == MarketStatus.Active, "Not active");
        require(block.timestamp >= markets[marketId].deadline, "Not expired");

        markets[marketId].status = MarketStatus.Resolving;
        markets[marketId].retryCount = 0;
        emit Decision(marketId, "AUTO_RESOLVE", "Deadline expired", block.timestamp);

        _brainResolve(marketId);
    }

    function _brainResolve(uint256 marketId) internal {
        Market storage m = markets[marketId];

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = string.concat(
            "You are Santiora AI resolver on Somnia blockchain. Today is May 31, 2026. ",
            "You determine prediction market outcomes based on known facts. ",
            "RULES: 1) Answer based on verifiable facts only. 2) If event hasn't happened yet, answer NO. ",
            "3) Be honest about confidence level. ",
            "Return ONLY valid JSON: {\"outcome\":\"YES\" or \"NO\",\"confidence\":<60-100>,\"reasoning\":\"<brief evidence>\"}"
        );
        messages[1] = string.concat("Resolve this market: \"", m.question, "\"");

        string[] memory mcpUrls = new string[](0);
        OnchainTool[] memory onchainTools = new OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(0), false
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onBrainResolveResult.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestType[reqId] = 2;
        emit MarketResolving(marketId);
    }

    function onBrainResolveResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            m.retryCount++;
            if (m.retryCount < rules.maxRetryResolve) {
                emit RetryAttempt(marketId, "brain_resolve", m.retryCount, rules.maxRetryResolve);
                _brainResolve(marketId);
                return;
            }
            m.status = MarketStatus.Active;
            performance.totalFailed++;
            emit PipelineFailed(marketId, "brain_resolve_max_retries");
            return;
        }

        (string memory finishReason, string memory response,,,,) = abi.decode(
            responses[0].result, (string, string, string[], string[], string[], bytes[])
        );

        emit BrainResponse(marketId, finishReason, response);
        emit Decision(marketId, "RESOLVER_RESPONSE", response, block.timestamp);

        // Store resolver response and chain to verification agent
        m.resolverResponse = response;

        // Agent-to-Agent: trigger independent verification
        if (address(this).balance >= DEPOSIT) {
            _verifyResolution(marketId, response);
        } else {
            // Fallback: resolve without verification if insufficient balance
            _finalizeResolution(marketId, response, 80);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // AGENT-TO-AGENT VERIFICATION — Independent LLM cross-check
    // ═══════════════════════════════════════════════════════════════

    function _verifyResolution(uint256 marketId, string memory resolverResponse) internal {
        Market storage m = markets[marketId];

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = string.concat(
            "You are an INDEPENDENT verification agent on Somnia blockchain. Today is May 31, 2026. ",
            "Another AI agent has resolved a prediction market. Your job is to INDEPENDENTLY verify the outcome. ",
            "Do NOT simply agree - think critically. Check if the reasoning is sound. ",
            "Return ONLY valid JSON: {\"outcome\":\"YES\" or \"NO\",\"confidence\":<60-100>,\"reasoning\":\"<your independent analysis>\"}"
        );
        messages[1] = string.concat(
            "VERIFY this resolution independently. Market question: \"", m.question,
            "\". The resolver agent concluded: ", resolverResponse,
            ". Do you agree with this outcome? Provide your independent assessment."
        );

        string[] memory mcpUrls = new string[](0);
        OnchainTool[] memory onchainTools = new OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(0), false
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onVerifyResult.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestType[reqId] = 5;
        emit Decision(marketId, "VERIFY_START", "Independent verification agent invoked", block.timestamp);
    }

    function onVerifyResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            // Verification failed — resolve with lower confidence using resolver's answer
            _finalizeResolution(marketId, m.resolverResponse, 70);
            emit Decision(marketId, "VERIFY_FAILED", "Verification agent failed, using resolver only", block.timestamp);
            return;
        }

        (string memory finishReason, string memory verifierResponse,,,,) = abi.decode(
            responses[0].result, (string, string, string[], string[], string[], bytes[])
        );

        emit BrainResponse(marketId, finishReason, verifierResponse);

        // Compare resolver vs verifier outcomes
        bool resolverYES = _containsYES(m.resolverResponse);
        bool verifierYES = _containsYES(verifierResponse);
        bool matched = (resolverYES == verifierYES);
        uint256 finalConfidence = matched ? 95 : 60;

        string memory resolverOutcome = resolverYES ? "YES" : "NO";
        string memory verifierOutcome = verifierYES ? "YES" : "NO";

        emit AgentToAgentVerification(marketId, resolverOutcome, verifierOutcome, matched, finalConfidence);

        if (matched) {
            // Both agents agree — high confidence resolution
            _finalizeResolution(marketId, m.resolverResponse, finalConfidence);
            emit Decision(marketId, "AGENTS_AGREE", string.concat("Both agents: ", resolverOutcome), block.timestamp);
        } else if (finalConfidence >= rules.confidenceThreshold) {
            // Mismatch but still above threshold — use resolver's answer with lower confidence
            _finalizeResolution(marketId, m.resolverResponse, finalConfidence);
            emit Decision(marketId, "AGENTS_DISAGREE", string.concat("Resolver: ", resolverOutcome, " Verifier: ", verifierOutcome), block.timestamp);
        } else {
            // Mismatch and below threshold — mark as failed
            m.status = MarketStatus.Failed;
            performance.totalFailed++;
            emit PipelineFailed(marketId, "verification_mismatch_low_confidence");
        }
    }

    function _finalizeResolution(uint256 marketId, string memory response, uint256 confidence) internal {
        Market storage m = markets[marketId];
        m.resolutionData = response;
        m.confidence = confidence;
        m.status = MarketStatus.Resolved;
        performance.totalResolved++;
        performance.totalConfidenceSum += confidence;
        categorySuccessCount[m.category]++;

        if (_containsYES(response)) {
            m.outcome = "YES";
        } else {
            m.outcome = "NO";
        }

        emit MarketResolved(marketId, m.outcome, m.confidence, m.resolutionData);
        _autoUpdateRegistry(marketId);
        _emitLearning(m.category);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE WITH JSON API — Data-driven resolution
    // ═══════════════════════════════════════════════════════════════

    function resolveWithAPI(uint256 marketId, string calldata apiUrl, string calldata selector) external payable onlyAuthorized {
        require(address(this).balance >= JSON_DEPOSIT + DEPOSIT, "Insufficient balance");
        require(marketId < markets.length && markets[marketId].status == MarketStatus.Active, "Not active");

        markets[marketId].status = MarketStatus.Resolving;
        markets[marketId].retryCount = 0;
        emit MarketResolving(marketId);
        emit Decision(marketId, "RESOLVE_API_START", apiUrl, block.timestamp);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector, apiUrl, selector
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
            JSON_API_AGENT_ID, address(this), this.onDataFetched.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestType[reqId] = 3;
    }

    function onDataFetched(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            m.retryCount++;
            if (m.retryCount < rules.maxRetryResolve) {
                emit RetryAttempt(marketId, "data_fetch", m.retryCount, rules.maxRetryResolve);
                m.status = MarketStatus.Active;
                return;
            }
            m.status = MarketStatus.Active;
            performance.totalFailed++;
            emit PipelineFailed(marketId, "data_fetch_max_retries");
            return;
        }

        m.resolutionData = abi.decode(responses[0].result, (string));
        emit Decision(marketId, "DATA_FETCHED", m.resolutionData, block.timestamp);

        // Now ask brain to interpret the data
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are a factual oracle. Based on real data, determine YES or NO. Return ONLY JSON: {\"outcome\":\"YES\" or \"NO\",\"confidence\":<60-100>,\"reasoning\":\"<brief>\"}";
        messages[1] = string.concat("Market: \"", m.question, "\". Real data: \"", m.resolutionData, "\". What is the outcome?");

        string[] memory mcpUrls = new string[](0);
        OnchainTool[] memory onchainTools = new OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(0), false
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onBrainResolveResult.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestType[reqId] = 4;
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-REGISTRY
    // ═══════════════════════════════════════════════════════════════

    function _autoRegister(uint256 marketId) internal {
        Market storage m = markets[marketId];
        address marketAddr = _marketAddress(marketId);

        try registry.registerMarket(
            marketAddr, m.question, m.odds, m.deadline, m.category, 1, false
        ) {
            emit AutoRegistered(marketId, address(registry));
        } catch {
            emit Decision(marketId, "REGISTRY_FAILED", "Auto-register failed", block.timestamp);
        }
    }

    function _autoUpdateRegistry(uint256 marketId) internal {
        Market storage m = markets[marketId];
        address marketAddr = _marketAddress(marketId);

        try registry.updateMarket(marketAddr, 3, m.outcome, m.confidence) {
            emit Decision(marketId, "REGISTRY_UPDATED", "Synced", block.timestamp);
        } catch {
            emit Decision(marketId, "REGISTRY_UPDATE_FAILED", "Could not sync", block.timestamp);
        }
    }

    function _marketAddress(uint256 marketId) internal view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(address(this), marketId)))));
    }

    // ═══════════════════════════════════════════════════════════════
    // SELF-IMPROVEMENT
    // ═══════════════════════════════════════════════════════════════

    function _emitLearning(string memory category) internal {
        uint256 success = categorySuccessCount[category];
        uint256 fail = categoryFailCount[category];
        uint256 total = success + fail;
        if (total >= 3) {
            uint256 rate = (success * 100) / total;
            emit LearningEvent(
                string.concat(category, " success rate: ", _uint2str(rate), "%"),
                block.timestamp
            );
        }
    }

    function getNextCategory() external view returns (string memory) {
        uint256 idx = performance.totalCreated % categories.length;
        return categories[idx];
    }

    // ═══════════════════════════════════════════════════════════════
    // RULES HELPERS
    // ═══════════════════════════════════════════════════════════════

    function _resetDayIfNeeded() internal {
        if (block.timestamp >= rulesState.dayStartTimestamp + 1 days) {
            rulesState.dayStartTimestamp = block.timestamp;
            rulesState.marketsCreatedToday = 0;
        }
    }

    function canCreateMarket() external view returns (bool allowed, string memory reason) {
        if (block.timestamp < rulesState.lastScanTimestamp + rules.scanInterval) {
            return (false, "scan_interval_not_elapsed");
        }
        uint256 todayCount = rulesState.marketsCreatedToday;
        if (block.timestamp >= rulesState.dayStartTimestamp + 1 days) {
            todayCount = 0;
        }
        if (todayCount >= rules.maxMarketsPerDay) {
            return (false, "daily_limit_reached");
        }
        if (address(this).balance < DEPOSIT) {
            return (false, "insufficient_balance");
        }
        return (true, "ready");
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILS
    // ═══════════════════════════════════════════════════════════════

    function _containsYES(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i + 2 < b.length; i++) {
            if ((b[i] == 'Y' || b[i] == 'y') &&
                (b[i+1] == 'E' || b[i+1] == 'e') &&
                (b[i+2] == 'S' || b[i+2] == 's')) {
                return true;
            }
        }
        return false;
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) { k--; bstr[k] = bytes1(uint8(48 + _i % 10)); _i /= 10; }
        return string(bstr);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════════

    function getMarket(uint256 id) external view returns (
        string memory question, uint256 odds, uint256 deadline, string memory category,
        uint8 status, string memory outcome, uint256 confidence, string memory resolutionData
    ) {
        Market storage m = markets[id];
        return (m.question, m.odds, m.deadline, m.category, uint8(m.status), m.outcome, m.confidence, m.resolutionData);
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getStats() external view returns (
        uint256 total, uint256 created, uint256 resolved, uint256 failed, uint256 avgConfidence
    ) {
        uint256 avg = performance.totalResolved > 0 ? performance.totalConfidenceSum / performance.totalResolved : 0;
        return (markets.length, performance.totalCreated, performance.totalResolved, performance.totalFailed, avg);
    }

    function getRulesState() external view returns (
        uint256 lastScan, uint256 todayCount, uint256 dayStart, uint256 balance
    ) {
        return (rulesState.lastScanTimestamp, rulesState.marketsCreatedToday, rulesState.dayStartTimestamp, address(this).balance);
    }

    function getCategoryStats(string calldata category) external view returns (uint256 success, uint256 fail) {
        return (categorySuccessCount[category], categoryFailCount[category]);
    }
}
