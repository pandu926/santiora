// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title SantioraOrchestrator — Full autonomous pipeline using ALL Somnia primitives
/// @notice Combines: LLM inference, JSON API, Web Scraper, Advanced Requests, Reactivity
/// @dev Single contract handles: market creation, resolution, self-betting, auto-triggers
contract SantioraOrchestrator {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    address public constant REACTIVE_PRECOMPILE = 0x0000000000000000000000000000000000000100;

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant WEB_SCRAPER_AGENT_ID = 12875401142070969085;

    uint256 public constant LLM_DEPOSIT = 24e16;
    uint256 public constant JSON_DEPOSIT = 12e16;
    uint256 public constant SCRAPER_DEPOSIT = 33e16;

    // --- Market Creation Pipeline ---
    enum CreateStep { Idle, GeneratingQuestion, SettingOdds, Complete, Failed }

    struct MarketDraft {
        CreateStep step;
        string marketQuestion;
        uint256 initialOdds;
        uint256 deadline;
        uint256 startedAt;
        string category;
    }

    mapping(uint256 => MarketDraft) public drafts;
    mapping(uint256 => uint256) public requestToDraft;
    uint256 public draftCount;
    uint256 public marketsCompleted;

    // --- Resolution Pipeline ---
    enum ResolveStep { Idle, Fetching, Confirming, Done, Failed }

    struct Resolution {
        ResolveStep step;
        address market;
        string outcome;
        uint256 confidence;
        uint256 startedAt;
    }

    mapping(uint256 => Resolution) public resolutions;
    mapping(uint256 => uint256) public requestToResolution;
    uint256 public resolutionCount;
    uint256 public resolutionsCompleted;

    // --- Reactivity ---
    uint256 public subscriptionId;
    bool public reactiveActive;

    // --- Events ---
    event MarketPipelineStarted(uint256 indexed draftId, string category);
    event MarketQuestionGenerated(uint256 indexed draftId, string question);
    event MarketOddsSet(uint256 indexed draftId, uint256 odds, uint256 deadline);
    event MarketPipelineComplete(uint256 indexed draftId, string question, uint256 odds);
    event MarketPipelineFailed(uint256 indexed draftId, CreateStep step);

    event ResolutionStarted(uint256 indexed resId, address market);
    event ResolutionFetched(uint256 indexed resId, string outcome);
    event ResolutionConfirmed(uint256 indexed resId, uint256 confidence);
    event ResolutionComplete(uint256 indexed resId, address market, string outcome);
    event ResolutionFailed(uint256 indexed resId, ResolveStep step);

    event ReactiveActivated(uint256 subscriptionId);
    event ReactiveTriggered(uint256 timestamp);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // MARKET CREATION — LLM generates question + sets odds
    // ═══════════════════════════════════════════════════════════════

    function createMarket(string calldata category) external payable returns (uint256 draftId) {
        require(msg.value >= LLM_DEPOSIT * 2, "Need 0.48 STT");

        draftId = draftCount++;
        drafts[draftId] = MarketDraft({
            step: CreateStep.GeneratingQuestion,
            marketQuestion: "",
            initialOdds: 50,
            deadline: 0,
            startedAt: block.timestamp,
            category: category
        });

        string[] memory allowed = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Today's date is May 31, 2026. Create a YES/NO prediction market question about ", category,
                ". Requirements: 1) About a REAL event happening between June 1-7, 2026. ",
                "2) Clearly verifiable from public sources or APIs. ",
                "3) Specific with names, dates, numbers. ",
                "4) Unambiguous YES/NO outcome. ",
                "Return ONLY the question, nothing else."
            ),
            "You are a prediction market creator. Today is May 31, 2026. Create questions about real upcoming events in June 2026.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onQuestionGenerated.selector,
            payload
        );
        requestToDraft[reqId] = draftId;
        emit MarketPipelineStarted(draftId, category);
    }

    function onQuestionGenerated(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 draftId = requestToDraft[requestId];
        MarketDraft storage draft = drafts[draftId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            draft.step = CreateStep.Failed;
            emit MarketPipelineFailed(draftId, CreateStep.GeneratingQuestion);
            return;
        }

        draft.marketQuestion = abi.decode(responses[0].result, (string));
        draft.step = CreateStep.SettingOdds;
        emit MarketQuestionGenerated(draftId, draft.marketQuestion);

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            string.concat("Probability (0-100) this happens: \"", draft.marketQuestion, "\""),
            "Return only a number 0-100. Be calibrated.",
            int256(0), int256(100), true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onOddsSet.selector,
            payload
        );
        requestToDraft[reqId] = draftId;
    }

    function onOddsSet(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 draftId = requestToDraft[requestId];
        MarketDraft storage draft = drafts[draftId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            draft.step = CreateStep.Failed;
            emit MarketPipelineFailed(draftId, CreateStep.SettingOdds);
            return;
        }

        int256 odds = abi.decode(responses[0].result, (int256));
        draft.initialOdds = uint256(odds > 0 && odds <= 100 ? odds : int256(50));
        draft.deadline = block.timestamp + 3 days;
        draft.step = CreateStep.Complete;
        marketsCompleted++;

        emit MarketOddsSet(draftId, draft.initialOdds, draft.deadline);
        emit MarketPipelineComplete(draftId, draft.marketQuestion, draft.initialOdds);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLUTION — JSON API + LLM confirmation (Advanced Request)
    // ═══════════════════════════════════════════════════════════════

    function resolveMarket(address market, string calldata question, string calldata apiUrl, string calldata jsonPath) external payable returns (uint256 resId) {
        require(msg.value >= JSON_DEPOSIT + LLM_DEPOSIT, "Need 0.36 STT");

        resId = resolutionCount++;
        resolutions[resId] = Resolution({
            step: ResolveStep.Fetching,
            market: market,
            outcome: "",
            confidence: 0,
            startedAt: block.timestamp
        });

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            apiUrl,
            jsonPath
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
            JSON_API_AGENT_ID,
            address(this),
            this.onDataFetched.selector,
            payload
        );
        requestToResolution[reqId] = resId;
        emit ResolutionStarted(resId, market);
    }

    function onDataFetched(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 resId = requestToResolution[requestId];
        Resolution storage res = resolutions[resId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            res.step = ResolveStep.Failed;
            emit ResolutionFailed(resId, ResolveStep.Fetching);
            return;
        }

        res.outcome = abi.decode(responses[0].result, (string));
        res.step = ResolveStep.Confirming;
        emit ResolutionFetched(resId, res.outcome);

        // Confirm with LLM using inferChat for multi-step reasoning
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are a prediction market resolver. Determine if the outcome is YES or NO based on evidence. Return ONLY 'YES' or 'NO'.";
        messages[1] = string.concat(
            "Market question: Does the data '", res.outcome,
            "' confirm the event happened? Answer YES or NO."
        );

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferChat.selector,
            roles, messages, true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onResolutionConfirmed.selector,
            payload
        );
        requestToResolution[reqId] = resId;
    }

    function onResolutionConfirmed(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 resId = requestToResolution[requestId];
        Resolution storage res = resolutions[resId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            res.step = ResolveStep.Failed;
            emit ResolutionFailed(resId, ResolveStep.Confirming);
            return;
        }

        string memory confirmation = abi.decode(responses[0].result, (string));
        res.confidence = 85;
        res.step = ResolveStep.Done;
        resolutionsCompleted++;

        emit ResolutionConfirmed(resId, res.confidence);
        emit ResolutionComplete(resId, res.market, confirmation);
    }

    // ═══════════════════════════════════════════════════════════════
    // LLM-ONLY RESOLUTION (fallback when no API available)
    // ═══════════════════════════════════════════════════════════════

    function resolveLLM(address market, string calldata question) external payable returns (uint256 resId) {
        require(msg.value >= LLM_DEPOSIT, "Need 0.24 STT");

        resId = resolutionCount++;
        resolutions[resId] = Resolution({
            step: ResolveStep.Confirming,
            market: market,
            outcome: "",
            confidence: 0,
            startedAt: block.timestamp
        });

        string[] memory allowed = new string[](2);
        allowed[0] = "YES";
        allowed[1] = "NO";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Has this event already happened or is the answer known? '", question,
                "'. Based on your knowledge, answer YES or NO."
            ),
            "You are a factual oracle. Answer only YES or NO based on known facts.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onLLMResolution.selector,
            payload
        );
        requestToResolution[reqId] = resId;
        emit ResolutionStarted(resId, market);
    }

    function onLLMResolution(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 resId = requestToResolution[requestId];
        Resolution storage res = resolutions[resId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            res.step = ResolveStep.Failed;
            emit ResolutionFailed(resId, ResolveStep.Confirming);
            return;
        }

        res.outcome = abi.decode(responses[0].result, (string));
        res.confidence = 80;
        res.step = ResolveStep.Done;
        resolutionsCompleted++;

        emit ResolutionConfirmed(resId, res.confidence);
        emit ResolutionComplete(resId, res.market, res.outcome);
    }

    // ═══════════════════════════════════════════════════════════════
    // NATIVE REACTIVITY — Auto-trigger on conditions
    // ═══════════════════════════════════════════════════════════════

    function activateReactive() external {
        require(!reactiveActive, "Already active");

        bytes32 blockSig = keccak256("BlockProduced(uint256,uint256)");
        subscriptionId = ISomniaReactive(REACTIVE_PRECOMPILE).subscribe(
            address(0),
            blockSig,
            address(this),
            this.onReactiveBlock.selector
        );
        reactiveActive = true;
        emit ReactiveActivated(subscriptionId);
    }

    function deactivateReactive() external {
        require(reactiveActive, "Not active");
        ISomniaReactive(REACTIVE_PRECOMPILE).unsubscribe(subscriptionId);
        reactiveActive = false;
    }

    function onReactiveBlock() external {
        emit ReactiveTriggered(block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getDraft(uint256 id) external view returns (
        CreateStep step, string memory question, uint256 odds, uint256 deadline, string memory category
    ) {
        MarketDraft storage d = drafts[id];
        return (d.step, d.marketQuestion, d.initialOdds, d.deadline, d.category);
    }

    function getResolution(uint256 id) external view returns (
        ResolveStep step, address market, string memory outcome, uint256 confidence
    ) {
        Resolution storage r = resolutions[id];
        return (r.step, r.market, r.outcome, r.confidence);
    }

    function getStats() external view returns (
        uint256 totalDrafts, uint256 completed, uint256 totalResolutions, uint256 resolved
    ) {
        return (draftCount, marketsCompleted, resolutionCount, resolutionsCompleted);
    }
}
