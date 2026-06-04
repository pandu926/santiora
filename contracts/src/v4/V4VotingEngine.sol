// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V4Types.sol";
import "./V4Helpers.sol";
import "../interfaces/IAgentPlatform.sol";

/// @title V4VotingEngine - 3-LLM voting to assess data sufficiency
/// @notice Spawns 3 independent LLM voters, tallies majority, triggers loop or proceed.
abstract contract V4VotingEngine {
    using V4Helpers for string;

    // ===========================================================================
    // VOTER SYSTEM PROMPTS
    // ===========================================================================

    function _createVoterPrompt() internal pure returns (string memory) {
        return
            "You are a data-sufficiency judge for an autonomous prediction market protocol. "
            "Your ONLY job: decide if the gathered data is enough to BUILD a fair YES/NO market about a FUTURE event.\n\n"
            "IMPORTANT: A prediction market asks about an outcome that has NOT happened yet. "
            "The winner/result being UNKNOWN is REQUIRED, not a flaw. Do NOT reject data for "
            "'missing outcome' or 'missing winner' - the unknown future is the point.\n\n"
            "Vote sufficient=TRUE if the data contains ALL THREE:\n"
            "  1. ENTITIES: named participants (teams, assets, persons).\n"
            "  2. FUTURE ANCHOR: a future date/fixture/deadline to resolve against.\n"
            "  3. RESOLVABILITY: the same data source can be re-queried later for YES/NO.\n\n"
            "Vote sufficient=FALSE ONLY if a required piece is truly absent.\n\n"
            "Reply ONLY valid JSON: {\"sufficient\":true,\"missing\":\"\"} "
            "or {\"sufficient\":false,\"missing\":\"the ONE required element that is absent\"}.";
    }

    function _resolveVoterPrompt() internal pure returns (string memory) {
        return
            "You are a resolution-readiness judge for an autonomous prediction market. "
            "Your job: decide if the data UNAMBIGUOUSLY determines the answer to the question.\n\n"
            "CRITICAL: Do not accept ambiguous data. For a match decided by penalties, "
            "a score like '1-1' is NOT enough to know who WON - you need the shootout "
            "result or an explicit winner statement.\n\n"
            "Vote sufficient=TRUE only if: the data clearly states the final result/winner "
            "needed to answer the exact question.\n"
            "Vote sufficient=FALSE if: the result is ambiguous, the data is about a different "
            "event, or the decisive outcome is missing.\n\n"
            "Reply ONLY valid JSON: {\"sufficient\":true,\"missing\":\"\"} "
            "or {\"sufficient\":false,\"missing\":\"the exact fact needed to resolve confidently\"}.";
    }

    // ===========================================================================
    // VOTE DISPATCH
    // ===========================================================================

    /// @notice Dispatch 3 voter LLM calls for a market
    function _dispatchVotes(
        uint256 marketId,
        string memory dataContext,
        string memory marketQuestion,
        RequestPhase phase
    ) internal {
        string memory systemPrompt = (phase == RequestPhase.CreateVote)
            ? _createVoterPrompt()
            : _resolveVoterPrompt();

        for (uint8 i = 0; i < VOTE_QUORUM; i++) {
            string memory userMsg = (phase == RequestPhase.CreateVote)
                ? string.concat("Voter #", V4Helpers.toString(i), ". Evaluate this gathered data:\n", dataContext)
                : string.concat("Voter #", V4Helpers.toString(i), ". QUESTION TO RESOLVE: ", marketQuestion, "\nGathered data: ", dataContext);

            _sendLLM(marketId, systemPrompt, userMsg, phase);
        }
    }

    /// @notice Process a single vote response, return (allVotesDone, majorityYes)
    function _tallyVote(
        ResearchState storage rs,
        string memory response
    ) internal returns (bool allDone, bool majorityYes) {
        if (V4Helpers.jsonBool(response, "sufficient")) {
            rs.votesYes++;
        } else {
            rs.votesNo++;
            string memory missing = V4Helpers.jsonString(response, "missing");
            if (bytes(missing).length > 0) {
                rs.missingHints = string.concat(rs.missingHints, missing, "; ");
            }
        }

        rs.votesPending--;
        allDone = (rs.votesPending == 0);
        majorityYes = (rs.votesYes >= VOTE_THRESHOLD);
    }

    // ===========================================================================
    // LLM DISPATCH HELPER
    // ===========================================================================

    function _sendLLM(
        uint256 marketId,
        string memory systemPrompt,
        string memory userMessage,
        RequestPhase phase
    ) internal {
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = systemPrompt;
        messages[1] = userMessage;

        string[] memory mcp = new string[](0);
        OnchainTool[] memory tools = new OnchainTool[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcp, tools, uint256(0), false
        );

        bytes4 callback = _voteCallback(phase);
        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID, address(this), callback, payload
        );

        _trackRequest(reqId, marketId, phase);
    }

    function _voteCallback(RequestPhase phase) internal pure returns (bytes4) {
        if (phase == RequestPhase.CreateVote) return this.onCreateVoteResult.selector;
        if (phase == RequestPhase.ResolveVote) return this.onResolveVoteResult.selector;
        if (phase == RequestPhase.CreateFinal) return this.onCreateFinalResult.selector;
        return this.onResolveFinalResult.selector;
    }

    // ===========================================================================
    // ABSTRACT (implemented by SantioraV4)
    // ===========================================================================

    function _trackRequest(uint256 reqId, uint256 marketId, RequestPhase phase) internal virtual;

    function onCreateVoteResult(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
    function onResolveVoteResult(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
    function onCreateFinalResult(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
    function onResolveFinalResult(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
}
