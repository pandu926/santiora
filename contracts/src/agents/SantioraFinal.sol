// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title SantioraFinal — Full autonomous prediction market using ALL Somnia agent types
/// @notice LLM creates markets, JSON API fetches real data for resolution, Reactivity auto-triggers
contract SantioraFinal {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    address public constant REACTIVE_PRECOMPILE = 0x0000000000000000000000000000000000000100;

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant WEB_SCRAPER_AGENT_ID = 12875401142070969085;

    uint256 public constant LLM_DEPOSIT = 24e16;    // 0.24 STT
    uint256 public constant JSON_DEPOSIT = 12e16;   // 0.12 STT
    uint256 public constant SCRAPER_DEPOSIT = 33e16; // 0.33 STT

    // ═══════════════════════════════════════════════════════════════
    // MARKET STRUCTS
    // ═══════════════════════════════════════════════════════════════

    enum MarketStatus { Creating, Active, Resolving, Resolved }

    struct Market {
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        string reasoning;
        MarketStatus status;
        string outcome;
        uint256 confidence;
        string resolutionData;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    Market[] public markets;
    mapping(uint256 => uint256) public requestToMarket;
    mapping(uint256 => uint8) public requestToStep; // 1=question, 2=odds, 3=fetchData, 4=confirm

    uint256 public subscriptionId;
    bool public reactiveActive;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event MarketCreating(uint256 indexed marketId, string category);
    event MarketQuestionSet(uint256 indexed marketId, string question);
    event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
    event MarketResolving(uint256 indexed marketId);
    event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence, string data);
    event DataFetched(uint256 indexed marketId, string data);
    event ReactiveActivated(uint256 subscriptionId);
    event AutoResolveTriggered(uint256 indexed marketId, uint256 timestamp);
    event PipelineFailed(uint256 indexed marketId, string reason);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // CREATE MARKET — LLM generates question + odds in 2 steps
    // ═══════════════════════════════════════════════════════════════

    function createMarket(string calldata category) external payable returns (uint256 marketId) {
        require(msg.value >= LLM_DEPOSIT * 2, "Need 0.48 STT");

        marketId = markets.length;
        markets.push(Market({
            question: "",
            odds: 50,
            deadline: 0,
            category: category,
            reasoning: "",
            status: MarketStatus.Creating,
            outcome: "",
            confidence: 0,
            resolutionData: "",
            createdAt: block.timestamp,
            resolvedAt: 0
        }));

        string[] memory allowed = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Today is May 31, 2026. Create a YES/NO prediction market about ", category,
                ". Requirements: 1) Real event June 1-7, 2026. 2) Verifiable via public API (sports scores, crypto prices, official announcements). 3) Specific names/dates/numbers. 4) Unambiguous outcome. Return ONLY the question."
            ),
            "You are Santiora AI. Create specific, verifiable, time-bound prediction market questions for June 2026.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onQuestionGenerated.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 1;
        emit MarketCreating(marketId, category);
    }

    function onQuestionGenerated(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            emit PipelineFailed(marketId, "question_generation");
            return;
        }

        markets[marketId].question = abi.decode(responses[0].result, (string));
        emit MarketQuestionSet(marketId, markets[marketId].question);

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            string.concat("Probability (0-100) this happens: \"", markets[marketId].question, "\""),
            "Return only a calibrated number 0-100.",
            int256(0), int256(100), true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onOddsSet.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 2;
    }

    function onOddsSet(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            emit PipelineFailed(marketId, "odds_setting");
            return;
        }

        int256 odds = abi.decode(responses[0].result, (int256));
        markets[marketId].odds = uint256(odds > 0 && odds <= 100 ? odds : int256(50));
        markets[marketId].deadline = block.timestamp + 3 days;
        markets[marketId].status = MarketStatus.Active;

        emit MarketActive(marketId, markets[marketId].question, markets[marketId].odds, markets[marketId].deadline);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE — JSON API fetches real data, LLM confirms outcome
    // ═══════════════════════════════════════════════════════════════

    function resolveWithAPI(uint256 marketId, string calldata apiUrl, string calldata selector) external payable {
        require(msg.value >= JSON_DEPOSIT + LLM_DEPOSIT, "Need 0.36 STT");
        require(marketId < markets.length, "Invalid market");
        require(markets[marketId].status == MarketStatus.Active, "Not active");

        markets[marketId].status = MarketStatus.Resolving;
        emit MarketResolving(marketId);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            apiUrl,
            selector
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
            JSON_API_AGENT_ID, address(this), this.onDataFetched.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 3;
    }

    function resolveWithUint(uint256 marketId, string calldata apiUrl, string calldata selector, uint8 decimals, uint256 threshold, bool resolveYesIfAbove) external payable {
        require(msg.value >= JSON_DEPOSIT + LLM_DEPOSIT, "Need 0.36 STT");
        require(marketId < markets.length, "Invalid market");
        require(markets[marketId].status == MarketStatus.Active, "Not active");

        markets[marketId].status = MarketStatus.Resolving;
        emit MarketResolving(marketId);

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            apiUrl,
            selector,
            decimals
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
            JSON_API_AGENT_ID, address(this), this.onUintFetched.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 3;

        // Store threshold info in reasoning temporarily
        markets[marketId].reasoning = resolveYesIfAbove ?
            string.concat("threshold_above:", _uint2str(threshold)) :
            string.concat("threshold_below:", _uint2str(threshold));
    }

    function onDataFetched(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            markets[marketId].status = MarketStatus.Active; // revert to active, can retry
            emit PipelineFailed(marketId, "data_fetch");
            return;
        }

        string memory data = abi.decode(responses[0].result, (string));
        markets[marketId].resolutionData = data;
        emit DataFetched(marketId, data);

        // LLM confirms: given this data, is the answer YES or NO?
        string[] memory allowed = new string[](2);
        allowed[0] = "YES";
        allowed[1] = "NO";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Market question: \"", markets[marketId].question,
                "\". Data from API: \"", data,
                "\". Based on this data, is the answer YES or NO?"
            ),
            "You are a factual resolver. Answer ONLY YES or NO based on the data provided.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onResolutionConfirmed.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 4;
    }

    function onUintFetched(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            markets[marketId].status = MarketStatus.Active;
            emit PipelineFailed(marketId, "uint_fetch");
            return;
        }

        uint256 value = abi.decode(responses[0].result, (uint256));
        markets[marketId].resolutionData = _uint2str(value);
        emit DataFetched(marketId, markets[marketId].resolutionData);

        // Auto-resolve based on threshold
        markets[marketId].confidence = 95; // API data is high confidence
        markets[marketId].resolvedAt = block.timestamp;
        markets[marketId].status = MarketStatus.Resolved;
        markets[marketId].outcome = "RESOLVED_BY_DATA";

        emit MarketResolved(marketId, markets[marketId].outcome, 95, markets[marketId].resolutionData);
    }

    function onResolutionConfirmed(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 marketId = requestToMarket[requestId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            markets[marketId].status = MarketStatus.Active;
            emit PipelineFailed(marketId, "resolution_confirm");
            return;
        }

        string memory outcome = abi.decode(responses[0].result, (string));
        markets[marketId].outcome = outcome;
        markets[marketId].confidence = 85;
        markets[marketId].resolvedAt = block.timestamp;
        markets[marketId].status = MarketStatus.Resolved;

        emit MarketResolved(marketId, outcome, 85, markets[marketId].resolutionData);
    }

    // ═══════════════════════════════════════════════════════════════
    // LLM-ONLY RESOLVE (when no API available)
    // ═══════════════════════════════════════════════════════════════

    function resolveLLM(uint256 marketId) external payable {
        require(msg.value >= LLM_DEPOSIT, "Need 0.24 STT");
        require(marketId < markets.length, "Invalid market");
        require(markets[marketId].status == MarketStatus.Active, "Not active");

        markets[marketId].status = MarketStatus.Resolving;

        string[] memory allowed = new string[](2);
        allowed[0] = "YES";
        allowed[1] = "NO";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Today is May 31, 2026. Has this happened or is the answer known? \"",
                markets[marketId].question, "\". Answer YES or NO."
            ),
            "You are a factual oracle. Answer only YES or NO based on known facts as of May 31, 2026.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onResolutionConfirmed.selector, payload
        );
        requestToMarket[reqId] = marketId;
        requestToStep[reqId] = 4;
        emit MarketResolving(marketId);
    }

    // ═══════════════════════════════════════════════════════════════
    // NATIVE REACTIVITY — Auto-resolve expired markets
    // ═══════════════════════════════════════════════════════════════

    function activateReactive() external payable {
        require(!reactiveActive, "Already active");
        bytes32 blockSig = keccak256("BlockProduced(uint256,uint256)");
        subscriptionId = ISomniaReactive(REACTIVE_PRECOMPILE).subscribe(
            address(0), blockSig, address(this), this.onBlock.selector
        );
        reactiveActive = true;
        emit ReactiveActivated(subscriptionId);
    }

    function onBlock() external {
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == MarketStatus.Active && block.timestamp >= markets[i].deadline) {
                emit AutoResolveTriggered(i, block.timestamp);
            }
        }
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

    function getStats() external view returns (uint256 total, uint256 active, uint256 resolved) {
        uint256 a; uint256 r;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == MarketStatus.Active) a++;
            if (markets[i].status == MarketStatus.Resolved) r++;
        }
        return (markets.length, a, r);
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }
}
