// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title MarketCreatorV4Agent — Correct platform + deposit + encoding
/// @notice Pipeline: scrape → question → odds → complete (fully autonomous)
contract MarketCreatorV4Agent {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant PARSE_WEBSITE_AGENT_ID = 12875401142070969085;
    uint256 public constant LLM_DEPOSIT = 24e16;
    uint256 public constant SCRAPER_DEPOSIT = 60e16; // 0.60 STT (extra buffer for web scraper)

    enum PipelineStep { Idle, ScrapingNews, GeneratingQuestion, SettingOdds, Complete }

    struct MarketDraft {
        PipelineStep step;
        string scrapedNews;
        string marketQuestion;
        uint256 initialOdds;
        uint256 deadline;
        uint256 startedAt;
    }

    mapping(uint256 => MarketDraft) public drafts;
    mapping(uint256 => uint256) public requestToDraft;
    uint256 public draftCount;
    uint256 public marketsCompleted;

    event PipelineStarted(uint256 indexed draftId, string source, uint256 timestamp);
    event NewsScraped(uint256 indexed draftId, string headline);
    event QuestionGenerated(uint256 indexed draftId, string question);
    event OddsSet(uint256 indexed draftId, uint256 odds);
    event DraftCompleted(uint256 indexed draftId, string question, uint256 odds, uint256 deadline);
    event PipelineFailed(uint256 indexed draftId, PipelineStep step, string reason);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only Agent Platform");
        _;
    }

    receive() external payable {}

    function startMarketCreation(string calldata sourceUrl) external payable returns (uint256 draftId) {
        require(msg.value >= SCRAPER_DEPOSIT + LLM_DEPOSIT + LLM_DEPOSIT, "Need 1.08 STT");

        draftId = draftCount++;
        drafts[draftId] = MarketDraft({
            step: PipelineStep.ScrapingNews,
            scrapedNews: "",
            marketQuestion: "",
            initialOdds: 50,
            deadline: 0,
            startedAt: block.timestamp
        });

        string[] memory options = new string[](0);
        bytes memory agentPayload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "trending_topic",
            "The most significant verifiable event headline for a YES/NO prediction market",
            options,
            "Extract the single most newsworthy verifiable event. Must be specific, time-bound within 1-7 days, and clearly verifiable.",
            sourceUrl,
            true,
            uint8(3),
            uint8(70)
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: SCRAPER_DEPOSIT}(
            PARSE_WEBSITE_AGENT_ID,
            address(this),
            this.handleNewsScraped.selector,
            agentPayload
        );
        requestToDraft[reqId] = draftId;
        emit PipelineStarted(draftId, sourceUrl, block.timestamp);
    }

    function handleNewsScraped(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 draftId = requestToDraft[requestId];
        MarketDraft storage draft = drafts[draftId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            draft.step = PipelineStep.Idle;
            emit PipelineFailed(draftId, PipelineStep.ScrapingNews, "Scraping failed");
            return;
        }

        draft.scrapedNews = abi.decode(responses[0].result, (string));
        draft.step = PipelineStep.GeneratingQuestion;
        emit NewsScraped(draftId, draft.scrapedNews);

        string[] memory allowed = new string[](0);
        bytes memory agentPayload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Based on this news: \"", draft.scrapedNews,
                "\". Create a YES/NO prediction market question. Requirements: 1) Clearly verifiable. 2) Resolves within 1-7 days. 3) Specific, unambiguous outcome. Return ONLY the question."
            ),
            "You are a prediction market creator. Create clear, time-bound YES/NO questions.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleQuestionGenerated.selector,
            agentPayload
        );
        requestToDraft[reqId] = draftId;
    }

    function handleQuestionGenerated(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 draftId = requestToDraft[requestId];
        MarketDraft storage draft = drafts[draftId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            draft.step = PipelineStep.Idle;
            emit PipelineFailed(draftId, PipelineStep.GeneratingQuestion, "Question generation failed");
            return;
        }

        draft.marketQuestion = abi.decode(responses[0].result, (string));
        draft.step = PipelineStep.SettingOdds;
        emit QuestionGenerated(draftId, draft.marketQuestion);

        bytes memory agentPayload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            string.concat("What is the probability (0-100) that this will happen: \"", draft.marketQuestion, "\""),
            "Return a number 0-100 representing the probability of YES outcome. Be calibrated.",
            int256(0),
            int256(100),
            true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.handleOddsSet.selector,
            agentPayload
        );
        requestToDraft[reqId] = draftId;
    }

    function handleOddsSet(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 draftId = requestToDraft[requestId];
        MarketDraft storage draft = drafts[draftId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            draft.step = PipelineStep.Idle;
            emit PipelineFailed(draftId, PipelineStep.SettingOdds, "Odds setting failed");
            return;
        }

        int256 odds = abi.decode(responses[0].result, (int256));
        draft.initialOdds = uint256(odds > 0 && odds <= 100 ? odds : int256(50));
        draft.deadline = block.timestamp + 3 days;
        draft.step = PipelineStep.Complete;
        marketsCompleted++;

        emit OddsSet(draftId, draft.initialOdds);
        emit DraftCompleted(draftId, draft.marketQuestion, draft.initialOdds, draft.deadline);
    }

    function getDraft(uint256 draftId) external view returns (
        PipelineStep step, string memory scrapedNews, string memory marketQuestion, uint256 initialOdds, uint256 deadline
    ) {
        MarketDraft storage d = drafts[draftId];
        return (d.step, d.scrapedNews, d.marketQuestion, d.initialOdds, d.deadline);
    }
}
