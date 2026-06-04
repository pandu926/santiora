// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V4Types.sol";
import "./V4Helpers.sol";
import "./V4Prompts.sol";
import "./V4DataGatherer.sol";
import "./V4VotingEngine.sol";
import "../interfaces/IAgentPlatform.sol";

interface IV4Registry {
    function registerMarket(address market, string calldata question, uint256 odds, uint256 deadline, string calldata category, uint8 status, bool isSUSD) external returns (uint256);
    function updateMarket(address market, uint8 status, string calldata outcome, uint256 confidence) external;
    function isDuplicate(string calldata question) external view returns (bool);
    function hasTopicCapacity(string calldata category) external view returns (bool);
}

/// @title SantioraV4 - Autonomous prediction markets with deep research AI
/// @notice V2 architecture (monolith, proven 2mo prod) + deep research quality layer.
///         Multi-source gather -> 3-LLM voting -> research loop -> create/resolve.
/// @dev Inherits V4DataGatherer (gather logic) and V4VotingEngine (voting logic).
contract SantioraV4 is V4DataGatherer, V4VotingEngine {
    using V4Helpers for string;

    // ===========================================================================
    // STATE
    // ===========================================================================

    IV4Registry public immutable registry;
    address public owner;
    address public reactiveContract;

    Rules public rules;
    RulesState public rulesState;
    Performance public performance;
    Market[] public markets;
    string[] public categories;

    mapping(string => uint256) public categorySuccessCount;
    mapping(string => uint256) public categoryFailCount;

    // ===========================================================================
    // MODIFIERS
    // ===========================================================================

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier onlyAuthorized() { require(msg.sender == owner || msg.sender == reactiveContract, "Not authorized"); _; }
    modifier onlyPlatform() { require(msg.sender == PLATFORM, "Only platform"); _; }

    // ===========================================================================
    // CONSTRUCTOR
    // ===========================================================================

    constructor(address registryAddress) {
        require(registryAddress != address(0), "Zero registry");
        registry = IV4Registry(registryAddress);
        owner = msg.sender;
        rules = Rules({
            scanInterval: 3600,
            minMarketDuration: 1 days,
            maxMarketDuration: 7 days,
            maxMarketsPerDay: 5,
            confidenceThreshold: 70,
            maxRounds: 3
        });
        rulesState = RulesState(0, 0, block.timestamp);
        categories.push("sports");
        categories.push("crypto");
        categories.push("finance");
        categories.push("technology");
    }

    receive() external payable {}

    // ===========================================================================
    // ADMIN
    // ===========================================================================

    function setReactiveContract(address reactive) external onlyOwner {
        reactiveContract = reactive;
    }

    function updateRules(Rules calldata newRules) external onlyOwner {
        rules = newRules;
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    // ===========================================================================
    // CREATE MARKET - Entry point
    // ===========================================================================

    function createMarket(string calldata category) external onlyAuthorized returns (uint256 marketId) {
        return _initiateCreate(category);
    }

    function createMarket() external onlyAuthorized returns (uint256 marketId) {
        string memory cat = categories[performance.totalCreated % categories.length];
        return _initiateCreate(cat);
    }

    function _initiateCreate(string memory category) internal returns (uint256 marketId) {
        _resetDayIfNeeded();
        (bool allowed, string memory reason) = _canCreate(category);
        if (!allowed) {
            emit Decision(type(uint256).max, "SKIP", reason);
            return type(uint256).max;
        }

        marketId = markets.length;
        Market storage m = markets.push();
        m.category = category;
        m.status = MarketStatus.Creating;
        m.createdAt = block.timestamp;
        m.research.round = 1;

        rulesState.lastScanTimestamp = block.timestamp;
        rulesState.marketsCreatedToday++;

        emit MarketCreating(marketId, category);
        _startCreateGather(marketId);
    }

    // ===========================================================================
    // RESOLVE MARKET - Entry point
    // ===========================================================================

    function resolveMarket(uint256 marketId) external onlyAuthorized {
        _initiateResolve(marketId);
    }

    function autoResolveExpired(uint256 marketId) external onlyAuthorized {
        _initiateResolve(marketId);
    }

    function _initiateResolve(uint256 marketId) internal {
        require(marketId < markets.length, "Invalid");
        Market storage m = markets[marketId];
        require(m.status == MarketStatus.Active, "Not active");
        require(block.timestamp >= m.deadline, "Not expired");

        m.status = MarketStatus.Resolving;
        m.research = ResearchState(1, "", 0, 0, 0, 0, "");
        emit MarketResolving(marketId);
        _startResolveGather(marketId);
    }

    // ===========================================================================
    // CREATE PIPELINE - gather -> vote -> create
    // ===========================================================================

    function _startCreateGather(uint256 marketId) internal {
        Market storage m = markets[marketId];
        DataQuery[] memory queries = _getQueries(m.category, m.research.round);
        m.research.sourcesPending = uint8(queries.length);
        _dispatchGather(marketId, queries, RequestPhase.CreateGather);
    }

    function onCreateDataGathered(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (status == ResponseStatus.Success && responses.length > 0) {
            string memory value = abi.decode(responses[0].result, (string));
            if (bytes(value).length > 0) {
                value = V4Helpers.truncate(value, MAX_FIELD_LENGTH);
                rs.dataContext = string.concat(rs.dataContext, "[", _labelFor(requestId), "]=", value, "; ");
                emit DataGathered(marketId, rs.round, _labelFor(requestId), uint8(status), bytes(value).length);
            } else {
                emit DataFeedback(marketId, rs.round, "empty response");
            }
        } else {
            emit DataFeedback(marketId, rs.round, "source failed");
        }

        rs.sourcesPending--;
        if (rs.sourcesPending == 0) {
            _onCreateGatherComplete(marketId);
        }
    }

    function _onCreateGatherComplete(uint256 marketId) internal {
        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (bytes(rs.dataContext).length < MIN_DATA_LENGTH) {
            _createResearchLoop(marketId, "data_too_thin");
            return;
        }

        rs.votesYes = 0;
        rs.votesNo = 0;
        rs.votesPending = uint8(VOTE_QUORUM);
        _dispatchVotes(marketId, rs.dataContext, "", RequestPhase.CreateVote);
    }

    function onCreateVoteResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        string memory response = "";
        if (status == ResponseStatus.Success && responses.length > 0) {
            response = V4Helpers.decodeChatResponse(responses[0].result);
        }

        (bool allDone, bool majorityYes) = _tallyVote(rs, response);
        if (!allDone) return;

        if (majorityYes) {
            emit VoteResult(marketId, rs.round, rs.votesYes, rs.votesNo, "SUFFICIENT");
            _sendCreateFinal(marketId);
        } else {
            emit VoteResult(marketId, rs.round, rs.votesYes, rs.votesNo, "INSUFFICIENT");
            _createResearchLoop(marketId, "votes_insufficient");
        }
    }

    function _createResearchLoop(uint256 marketId, string memory reason) internal {
        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (rs.round >= rules.maxRounds) {
            if (bytes(rs.dataContext).length >= MIN_DATA_LENGTH) {
                emit ResearchLoop(marketId, rs.round, "max_rounds_force_create");
                _sendCreateFinal(marketId);
            } else {
                _failMarket(marketId, "max_rounds_no_data");
            }
            return;
        }

        rs.round++;
        rs.votesYes = 0;
        rs.votesNo = 0;
        rs.missingHints = "";
        emit ResearchLoop(marketId, rs.round, reason);
        _startCreateGather(marketId);
    }

    function _sendCreateFinal(uint256 marketId) internal {
        Market storage m = markets[marketId];
        _sendLLM(
            marketId,
            V4Prompts.createMarketPrompt(),
            m.research.dataContext,
            RequestPhase.CreateFinal
        );
    }

    function onCreateFinalResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            _failMarket(marketId, "create_llm_failed");
            return;
        }

        string memory response = V4Helpers.decodeChatResponse(responses[0].result);
        string memory question = V4Helpers.jsonString(response, "question");

        if (bytes(question).length == 0 || V4Helpers.equals(question, "SKIP")) {
            _failMarket(marketId, "llm_skip_or_empty");
            return;
        }

        if (registry.isDuplicate(question)) {
            _failMarket(marketId, "duplicate");
            return;
        }

        uint256 odds = V4Helpers.bound(V4Helpers.jsonUint(response, "odds"), 1, 99);
        uint256 deadlineHours = V4Helpers.bound(V4Helpers.jsonUint(response, "deadline_hours"), 24, 168);
        uint256 deadline = block.timestamp + (deadlineHours * 1 hours);

        m.question = question;
        m.odds = odds;
        m.deadline = deadline;
        m.status = MarketStatus.Active;
        m.source = SourceInfo(
            _primarySourceUrl(m.category),
            _primarySourceSelector(m.category),
            _primaryLeagueId(m.category),
            m.research.dataContext
        );

        performance.totalCreated++;
        categorySuccessCount[m.category]++;

        _autoRegister(marketId);
        emit MarketActive(marketId, question, odds, deadline);
        emit Decision(marketId, "CREATED", response);
    }

    // ===========================================================================
    // RESOLVE PIPELINE - gather -> vote -> resolve
    // ===========================================================================

    function _startResolveGather(uint256 marketId) internal {
        Market storage m = markets[marketId];
        DataQuery[] memory queries = _getResolveQueries(m.source, m.research.round);
        m.research.sourcesPending = uint8(queries.length);
        _dispatchGather(marketId, queries, RequestPhase.ResolveGather);
    }

    function onResolveDataGathered(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (status == ResponseStatus.Success && responses.length > 0) {
            string memory value = abi.decode(responses[0].result, (string));
            if (bytes(value).length > 0) {
                value = V4Helpers.truncate(value, MAX_FIELD_LENGTH);
                rs.dataContext = string.concat(rs.dataContext, "[resolve_", V4Helpers.toString(rs.round), "]=", value, "; ");
                emit DataGathered(marketId, rs.round, "resolve_source", uint8(status), bytes(value).length);
            }
        } else {
            emit DataFeedback(marketId, rs.round, "resolve_source_failed");
        }

        rs.sourcesPending--;
        if (rs.sourcesPending == 0) {
            _onResolveGatherComplete(marketId);
        }
    }

    function _onResolveGatherComplete(uint256 marketId) internal {
        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (bytes(rs.dataContext).length < MIN_DATA_LENGTH) {
            _resolveResearchLoop(marketId, "resolve_data_thin");
            return;
        }

        rs.votesYes = 0;
        rs.votesNo = 0;
        rs.votesPending = uint8(VOTE_QUORUM);
        _dispatchVotes(marketId, rs.dataContext, m.question, RequestPhase.ResolveVote);
    }

    function onResolveVoteResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        string memory response = "";
        if (status == ResponseStatus.Success && responses.length > 0) {
            response = V4Helpers.decodeChatResponse(responses[0].result);
        }

        (bool allDone, bool majorityYes) = _tallyVote(rs, response);
        if (!allDone) return;

        if (majorityYes) {
            emit VoteResult(marketId, rs.round, rs.votesYes, rs.votesNo, "SUFFICIENT");
            _sendResolveFinal(marketId);
        } else {
            emit VoteResult(marketId, rs.round, rs.votesYes, rs.votesNo, "INSUFFICIENT");
            _resolveResearchLoop(marketId, "resolve_ambiguous");
        }
    }

    function _resolveResearchLoop(uint256 marketId, string memory reason) internal {
        Market storage m = markets[marketId];
        ResearchState storage rs = m.research;

        if (rs.round >= rules.maxRounds) {
            if (bytes(rs.dataContext).length >= MIN_DATA_LENGTH) {
                emit ResearchLoop(marketId, rs.round, "max_rounds_force_resolve");
                _sendResolveFinal(marketId);
            } else {
                m.status = MarketStatus.Active;
                emit PipelineFailed(marketId, "resolve_no_data");
            }
            return;
        }

        rs.round++;
        rs.votesYes = 0;
        rs.votesNo = 0;
        rs.missingHints = "";
        emit ResearchLoop(marketId, rs.round, reason);
        _startResolveGather(marketId);
    }

    function _sendResolveFinal(uint256 marketId) internal {
        Market storage m = markets[marketId];
        string memory userMsg = string.concat("QUESTION: ", m.question, "\nData: ", m.research.dataContext);
        _sendLLM(marketId, V4Prompts.resolveMarketPrompt(), userMsg, RequestPhase.ResolveFinal);
    }

    function onResolveFinalResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external override onlyPlatform {
        uint256 marketId = _requestToMarket[requestId];
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        Market storage m = markets[marketId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            m.status = MarketStatus.Active;
            emit PipelineFailed(marketId, "resolve_llm_failed");
            return;
        }

        string memory response = V4Helpers.decodeChatResponse(responses[0].result);
        string memory outcomeStr = V4Helpers.jsonString(response, "outcome");
        uint256 confidence = V4Helpers.bound(V4Helpers.jsonUint(response, "confidence"), 60, 100);

        if (confidence < rules.confidenceThreshold) {
            m.status = MarketStatus.Active;
            emit PipelineFailed(marketId, "low_confidence");
            return;
        }

        m.outcome = V4Helpers.isYes(outcomeStr) ? "YES" : "NO";
        m.confidence = confidence;
        m.status = MarketStatus.Resolved;

        performance.totalResolved++;
        performance.totalConfidenceSum += confidence;

        _autoUpdateRegistry(marketId);
        emit MarketResolved(marketId, m.outcome, confidence);
        emit Decision(marketId, "RESOLVED", response);
    }

    // ===========================================================================
    // INTERNAL - Registry, guards, helpers
    // ===========================================================================

    function _trackRequest(uint256 reqId, uint256 marketId, RequestPhase phase) internal override {
        _requestToMarket[reqId] = marketId;
        _requestPhase[reqId] = phase;
    }

    function _labelFor(uint256 reqId) internal view returns (string memory) {
        return bytes(_requestLabel[reqId]).length > 0 ? _requestLabel[reqId] : "src";
    }

    function _failMarket(uint256 marketId, string memory reason) internal {
        markets[marketId].status = MarketStatus.Failed;
        performance.totalFailed++;
        categoryFailCount[markets[marketId].category]++;
        emit PipelineFailed(marketId, reason);
    }

    function _autoRegister(uint256 marketId) internal {
        Market storage m = markets[marketId];
        address marketAddr = _marketAddress(marketId);
        try registry.registerMarket(marketAddr, m.question, m.odds, m.deadline, m.category, 1, false) {
            emit Decision(marketId, "REGISTERED", "");
        } catch {}
    }

    function _autoUpdateRegistry(uint256 marketId) internal {
        Market storage m = markets[marketId];
        try registry.updateMarket(_marketAddress(marketId), 3, m.outcome, m.confidence) {} catch {}
    }

    function _marketAddress(uint256 marketId) internal view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(address(this), marketId)))));
    }

    function _canCreate(string memory category) internal view returns (bool, string memory) {
        if (block.timestamp < rulesState.lastScanTimestamp + rules.scanInterval) return (false, "interval");
        uint256 today = block.timestamp >= rulesState.dayStartTimestamp + 1 days ? 0 : rulesState.marketsCreatedToday;
        if (today >= rules.maxMarketsPerDay) return (false, "daily_limit");
        if (!registry.hasTopicCapacity(category)) return (false, "topic_limit");
        uint256 needed = _estimateCost();
        if (address(this).balance < needed) return (false, "underfunded");
        return (true, "ready");
    }

    function _estimateCost() internal pure returns (uint256) {
        return (JSON_DEPOSIT * 3) + (LLM_DEPOSIT * VOTE_QUORUM) + LLM_DEPOSIT;
    }

    function _resetDayIfNeeded() internal {
        if (block.timestamp >= rulesState.dayStartTimestamp + 1 days) {
            rulesState.dayStartTimestamp = block.timestamp;
            rulesState.marketsCreatedToday = 0;
        }
    }

    function _primarySourceUrl(string memory category) internal pure returns (string memory) {
        if (V4Helpers.equals(category, "sports")) return "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4346";
        if (V4Helpers.equals(category, "crypto")) return "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
        if (V4Helpers.equals(category, "finance")) return "https://open.er-api.com/v6/latest/USD";
        return "https://api.github.com/search/repositories?q=topic:ai&sort=updated&order=desc&per_page=3";
    }

    function _primarySourceSelector(string memory category) internal pure returns (string memory) {
        if (V4Helpers.equals(category, "sports")) return "events[0].strEvent";
        if (V4Helpers.equals(category, "crypto")) return "bitcoin.usd";
        if (V4Helpers.equals(category, "finance")) return "rates.EUR";
        return "items[0].full_name";
    }

    function _primaryLeagueId(string memory category) internal pure returns (string memory) {
        if (V4Helpers.equals(category, "sports")) return "4346";
        if (V4Helpers.equals(category, "crypto")) return "";
        return "";
    }

    // ===========================================================================
    // VIEW - Public getters (backward compat with V2)
    // ===========================================================================

    function getMarket(uint256 id) external view returns (
        string memory question, uint256 odds, uint256 deadline,
        string memory category, uint8 status, string memory outcome,
        uint256 confidence, string memory data
    ) {
        Market storage m = markets[id];
        return (m.question, m.odds, m.deadline, m.category, uint8(m.status), m.outcome, m.confidence, m.research.dataContext);
    }

    function getMarketCount() external view returns (uint256) { return markets.length; }

    function getStats() external view returns (
        uint256 total, uint256 created, uint256 resolved, uint256 failed, uint256 avgConfidence
    ) {
        uint256 avg = performance.totalResolved == 0 ? 0 : performance.totalConfidenceSum / performance.totalResolved;
        return (markets.length, performance.totalCreated, performance.totalResolved, performance.totalFailed, avg);
    }

    function canCreateMarket() external view returns (bool, string memory) {
        string memory cat = categories[performance.totalCreated % categories.length];
        return _canCreate(cat);
    }

    function canCreateMarket(string calldata category) external view returns (bool, string memory) {
        return _canCreate(category);
    }

    function getNextCategory() external view returns (string memory) {
        return categories[performance.totalCreated % categories.length];
    }

    function getRulesState() external view returns (uint256 lastScan, uint256 todayCount, uint256 dayStart, uint256 balance) {
        return (rulesState.lastScanTimestamp, rulesState.marketsCreatedToday, rulesState.dayStartTimestamp, address(this).balance);
    }
}
