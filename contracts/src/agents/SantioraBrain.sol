// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title SantioraBrain — AI that thinks and acts autonomously using inferToolsChat
/// @notice AI decides what to do: create markets, resolve, fetch data, bet — all by itself
/// @dev Uses inferToolsChat for multi-step reasoning with on-chain tool execution
contract SantioraBrain {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant LLM_DEPOSIT = 24e16;
    uint256 public constant JSON_DEPOSIT = 12e16;

    struct ThoughtProcess {
        uint256 startedAt;
        string task;
        string reasoning;
        string action;
        string result;
        bool complete;
    }

    mapping(uint256 => ThoughtProcess) public thoughts;
    mapping(uint256 => uint256) public requestToThought;
    uint256 public thoughtCount;

    // Market data from AI decisions
    struct AIMarket {
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        string reasoning;
        bool resolved;
        string outcome;
    }

    AIMarket[] public markets;

    event ThinkStarted(uint256 indexed thoughtId, string task);
    event ThinkResult(uint256 indexed thoughtId, string reasoning, string action);
    event MarketCreatedByAI(uint256 indexed marketId, string question, uint256 odds, string reasoning);
    event MarketResolvedByAI(uint256 indexed marketId, string outcome, string reasoning);
    event ToolCallRequested(uint256 indexed thoughtId, string toolName, string args);
    event DataFetched(uint256 indexed thoughtId, string data);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // THINK — AI decides what to do with inferToolsChat
    // ═══════════════════════════════════════════════════════════════

    function think(string calldata task) external payable returns (uint256 thoughtId) {
        require(msg.value >= LLM_DEPOSIT, "Need 0.24 STT");

        thoughtId = thoughtCount++;
        thoughts[thoughtId] = ThoughtProcess({
            startedAt: block.timestamp,
            task: task,
            reasoning: "",
            action: "",
            result: "",
            complete: false
        });

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = string.concat(
            "You are Santiora AI, an autonomous prediction market agent. Today is May 31, 2026. ",
            "You can: 1) CREATE markets about upcoming events, 2) RESOLVE markets by determining outcomes, ",
            "3) ANALYZE odds and probabilities. ",
            "When creating a market, output JSON: {\"action\":\"create\",\"question\":\"...\",\"odds\":N,\"category\":\"...\",\"reasoning\":\"...\"}. ",
            "When resolving, output JSON: {\"action\":\"resolve\",\"outcome\":\"YES/NO\",\"confidence\":N,\"reasoning\":\"...\"}. ",
            "Be specific, use real events, real dates in June 2026."
        );
        messages[1] = task;

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferChat.selector,
            roles, messages, true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onThinkResult.selector,
            payload
        );
        requestToThought[reqId] = thoughtId;
        emit ThinkStarted(thoughtId, task);
    }

    function onThinkResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 thoughtId = requestToThought[requestId];
        ThoughtProcess storage t = thoughts[thoughtId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            t.complete = true;
            t.result = "FAILED";
            return;
        }

        string memory response = abi.decode(responses[0].result, (string));
        t.reasoning = response;
        t.complete = true;
        t.result = response;

        emit ThinkResult(thoughtId, response, "complete");
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTONOMOUS CYCLE — AI creates market from scratch
    // ═══════════════════════════════════════════════════════════════

    function autonomousCreate(string calldata category) external payable returns (uint256 thoughtId) {
        require(msg.value >= LLM_DEPOSIT, "Need 0.24 STT");

        thoughtId = thoughtCount++;
        thoughts[thoughtId] = ThoughtProcess({
            startedAt: block.timestamp,
            task: string.concat("create_market:", category),
            reasoning: "",
            action: "create",
            result: "",
            complete: false
        });

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are Santiora AI. Today is May 31, 2026. Create a prediction market. Return ONLY a JSON object with these exact fields: {\"question\":\"<specific YES/NO question about June 2026>\",\"odds\":<number 1-99>,\"category\":\"<category>\",\"reasoning\":\"<why these odds>\"}";
        messages[1] = string.concat("Create a prediction market about: ", category);

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferChat.selector,
            roles, messages, true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onAutonomousResult.selector,
            payload
        );
        requestToThought[reqId] = thoughtId;
        emit ThinkStarted(thoughtId, string.concat("autonomous_create:", category));
    }

    function onAutonomousResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 thoughtId = requestToThought[requestId];
        ThoughtProcess storage t = thoughts[thoughtId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            t.complete = true;
            t.result = "FAILED";
            return;
        }

        string memory response = abi.decode(responses[0].result, (string));
        t.reasoning = response;
        t.complete = true;
        t.result = response;

        // Store as market (AI decided everything)
        markets.push(AIMarket({
            question: response,
            odds: 50,
            deadline: block.timestamp + 3 days,
            category: t.task,
            reasoning: response,
            resolved: false,
            outcome: ""
        }));

        emit MarketCreatedByAI(markets.length - 1, response, 50, response);
        emit ThinkResult(thoughtId, response, "market_created");
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTONOMOUS RESOLVE — AI determines outcome
    // ═══════════════════════════════════════════════════════════════

    function autonomousResolve(uint256 marketId) external payable returns (uint256 thoughtId) {
        require(msg.value >= LLM_DEPOSIT, "Need 0.24 STT");
        require(marketId < markets.length, "Invalid market");
        require(!markets[marketId].resolved, "Already resolved");

        thoughtId = thoughtCount++;
        thoughts[thoughtId] = ThoughtProcess({
            startedAt: block.timestamp,
            task: string.concat("resolve_market:", markets[marketId].question),
            reasoning: "",
            action: "resolve",
            result: "",
            complete: false
        });

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are Santiora AI resolver. Today is May 31, 2026. Determine if this event has happened or will happen. Return ONLY a JSON: {\"outcome\":\"YES\" or \"NO\",\"confidence\":<60-100>,\"reasoning\":\"<evidence>\"}";
        messages[1] = string.concat("Resolve this market: ", markets[marketId].question);

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferChat.selector,
            roles, messages, true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onResolveResult.selector,
            payload
        );
        requestToThought[reqId] = thoughtId;
        emit ThinkStarted(thoughtId, string.concat("resolve:", markets[marketId].question));
    }

    function onResolveResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 thoughtId = requestToThought[requestId];
        ThoughtProcess storage t = thoughts[thoughtId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            t.complete = true;
            t.result = "FAILED";
            return;
        }

        string memory response = abi.decode(responses[0].result, (string));
        t.reasoning = response;
        t.complete = true;
        t.result = response;

        // Find and resolve the market
        for (uint256 i = 0; i < markets.length; i++) {
            if (!markets[i].resolved && keccak256(bytes(markets[i].question)) == keccak256(bytes(t.task))) {
                markets[i].resolved = true;
                markets[i].outcome = response;
                emit MarketResolvedByAI(i, response, response);
                break;
            }
        }

        emit ThinkResult(thoughtId, response, "resolved");
    }

    // ═══════════════════════════════════════════════════════════════
    // JSON API — Fetch real data for resolution
    // ═══════════════════════════════════════════════════════════════

    function fetchData(string calldata url, string calldata jsonPath) external payable returns (uint256 thoughtId) {
        require(msg.value >= JSON_DEPOSIT, "Need 0.12 STT");

        thoughtId = thoughtCount++;
        thoughts[thoughtId] = ThoughtProcess({
            startedAt: block.timestamp,
            task: string.concat("fetch:", url),
            reasoning: "",
            action: "fetch",
            result: "",
            complete: false
        });

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            url,
            jsonPath
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
            JSON_API_AGENT_ID,
            address(this),
            this.onDataResult.selector,
            payload
        );
        requestToThought[reqId] = thoughtId;
    }

    function onDataResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 thoughtId = requestToThought[requestId];
        ThoughtProcess storage t = thoughts[thoughtId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            t.complete = true;
            t.result = "FETCH_FAILED";
            return;
        }

        string memory data = abi.decode(responses[0].result, (string));
        t.result = data;
        t.complete = true;
        emit DataFetched(thoughtId, data);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════════

    function getThought(uint256 id) external view returns (
        uint256 startedAt, string memory task, string memory reasoning, string memory action, string memory result, bool complete
    ) {
        ThoughtProcess storage t = thoughts[id];
        return (t.startedAt, t.task, t.reasoning, t.action, t.result, t.complete);
    }

    function getMarket(uint256 id) external view returns (
        string memory question, uint256 odds, uint256 deadline, string memory category, string memory reasoning, bool resolved, string memory outcome
    ) {
        AIMarket storage m = markets[id];
        return (m.question, m.odds, m.deadline, m.category, m.reasoning, m.resolved, m.outcome);
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getStats() external view returns (uint256 totalThoughts, uint256 totalMarkets, uint256 resolvedMarkets) {
        uint256 resolved = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].resolved) resolved++;
        }
        return (thoughtCount, markets.length, resolved);
    }
}
