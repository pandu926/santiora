// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title MarketCreatorLLM — LLM-only pipeline (no web scraping)
/// @notice AI generates market questions and odds using LLM inference only
/// @dev Skips unreliable web scraper, uses LLM knowledge directly
contract MarketCreatorLLM {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_DEPOSIT = 24e16; // 0.24 STT

    enum PipelineStep { Idle, GeneratingQuestion, SettingOdds, Complete }

    struct MarketDraft {
        PipelineStep step;
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

    event PipelineStarted(uint256 indexed draftId, string category, uint256 timestamp);
    event QuestionGenerated(uint256 indexed draftId, string question);
    event OddsSet(uint256 indexed draftId, uint256 odds);
    event DraftCompleted(uint256 indexed draftId, string question, uint256 odds, uint256 deadline);
    event PipelineFailed(uint256 indexed draftId, PipelineStep step, string reason);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only Agent Platform");
        _;
    }

    receive() external payable {}

    function startMarketCreation(string calldata category) external payable returns (uint256 draftId) {
        require(msg.value >= LLM_DEPOSIT * 2, "Need 0.48 STT for 2 LLM calls");

        draftId = draftCount++;
        drafts[draftId] = MarketDraft({
            step: PipelineStep.GeneratingQuestion,
            marketQuestion: "",
            initialOdds: 50,
            deadline: 0,
            startedAt: block.timestamp,
            category: category
        });

        string[] memory allowed = new string[](0);
        bytes memory agentPayload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat(
                "Create a YES/NO prediction market question about ", category,
                ". Requirements: 1) About a REAL upcoming event in the next 1-7 days. 2) Clearly verifiable from public sources. 3) Specific with unambiguous outcome. 4) Include specific names, dates, or numbers. Return ONLY the question text, nothing else."
            ),
            "You are a prediction market creator for a crypto betting platform. Create engaging, specific, time-bound YES/NO questions about real events.",
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
        emit PipelineStarted(draftId, category, block.timestamp);
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
            "Return a number 0-100 representing the probability of YES outcome. Be well-calibrated based on available evidence and historical patterns.",
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
        PipelineStep step, string memory marketQuestion, uint256 initialOdds, uint256 deadline, string memory category
    ) {
        MarketDraft storage d = drafts[draftId];
        return (d.step, d.marketQuestion, d.initialOdds, d.deadline, d.category);
    }
}
