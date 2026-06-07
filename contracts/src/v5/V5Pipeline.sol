// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V5Types.sol";
import "./V5ToolRouter.sol";
import "../interfaces/IAgentPlatform.sol";

/// @title V5Pipeline - Abstract yield & resume state machine for LLM orchestration
/// @notice Manages the full inferToolsChat cycle: dispatch -> yield tool_calls -> execute -> resume
/// @dev Inherit this and implement `_onFinalResponse` and `_onPipelineFailed`
abstract contract V5Pipeline {
    using V5ToolRouter for bytes;

    IAgentRequester internal constant _platform = IAgentRequester(PLATFORM_ADDR);

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 => PipelineState) internal _pipeline;
    mapping(uint256 => uint256) internal _reqToMarket;
    mapping(uint256 => uint8) internal _reqToToolIdx;
    mapping(uint256 => bool) internal _requestConsumed;

    // ═══════════════════════════════════════════════════════════════
    // ABSTRACT HOOKS (implemented by SantioraV5)
    // ═══════════════════════════════════════════════════════════════

    /// @notice Called when LLM produces a final "stop" response
    function _onFinalResponse(uint256 marketId, string memory response) internal virtual;

    /// @notice Called when the pipeline encounters an unrecoverable error
    function _onPipelineFailed(uint256 marketId, string memory reason) internal virtual;

    // ═══════════════════════════════════════════════════════════════
    // DEPOSIT CALCULATION
    // ═══════════════════════════════════════════════════════════════

    /// @notice Calculate deposit needed per agent request
    function getDeposit() public view returns (uint256) {
        return _platform.getRequestDeposit() + PER_AGENT_COST * SUBCOMMITTEE_SIZE;
    }

    // ═══════════════════════════════════════════════════════════════
    // PIPELINE DISPATCH
    // ═══════════════════════════════════════════════════════════════

    /// @notice Start or resume an inferToolsChat request
    /// @param marketId The market this pipeline serves
    /// @param roles Message roles array
    /// @param messages Message contents array
    /// @param isResolve Whether this is a resolution (vs creation) pipeline
    function _dispatchInferToolsChat(
        uint256 marketId,
        string[] memory roles,
        string[] memory messages,
        bool isResolve
    ) internal {
        PipelineState storage pipe = _pipeline[marketId];
        pipe.phase = Phase.Orchestrating;
        pipe.isResolve = isResolve;

        string[] memory mcpUrls = new string[](0);
        OnchainTool[] memory tools = _buildTools();

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, tools, MAX_ITERATIONS, true
        );

        uint256 reqId = _platform.createRequest{value: getDeposit()}(
            LLM_AGENT_ID, address(this), this.onOrchestrateResult.selector, payload
        );
        _reqToMarket[reqId] = marketId;
    }

    // ═══════════════════════════════════════════════════════════════
    // CALLBACK: Orchestration result
    // ═══════════════════════════════════════════════════════════════

    /// @notice Callback from platform after inferToolsChat completes
    function onOrchestrateResult(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == PLATFORM_ADDR, "only platform");
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        uint256 marketId = _reqToMarket[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            _onPipelineFailed(marketId, "orchestration request failed");
            return;
        }

        try this.decodeOrchestrateResult(responses[0].result) returns (
            string memory finishReason,
            string memory response,
            string[] memory updRoles,
            string[] memory updMessages,
            string[] memory toolCallIds,
            bytes[] memory toolCalls
        ) {
            _processOrchestrateResult(marketId, finishReason, response, updRoles, updMessages, toolCallIds, toolCalls);
        } catch {
            _onPipelineFailed(marketId, "failed to decode LLM response");
        }
    }

    /// @dev External decoder for try/catch pattern
    function decodeOrchestrateResult(bytes memory data) external pure returns (
        string memory, string memory, string[] memory, string[] memory, string[] memory, bytes[] memory
    ) {
        return abi.decode(data, (string, string, string[], string[], string[], bytes[]));
    }

    function _processOrchestrateResult(
        uint256 marketId,
        string memory finishReason,
        string memory response,
        string[] memory updRoles,
        string[] memory updMessages,
        string[] memory toolCallIds,
        bytes[] memory toolCalls
    ) internal {
        if (_isStop(finishReason)) {
            _finalizePipeline(marketId, response);
            return;
        }

        if (_isToolCalls(finishReason) && toolCallIds.length > 0) {
            _handleToolYield(marketId, updRoles, updMessages, toolCallIds, toolCalls);
            return;
        }

        // max_iterations or unexpected
        if (bytes(response).length > 0) {
            _finalizePipeline(marketId, response);
        } else {
            _onPipelineFailed(marketId, "LLM returned no response");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOL YIELD HANDLING
    // ═══════════════════════════════════════════════════════════════

    function _handleToolYield(
        uint256 marketId,
        string[] memory updRoles,
        string[] memory updMessages,
        string[] memory toolCallIds,
        bytes[] memory toolCalls
    ) internal {
        PipelineState storage pipe = _pipeline[marketId];
        pipe.phase = Phase.ExecutingTools;
        pipe.iteration++;

        require(toolCallIds.length <= MAX_TOOLS_PER_YIELD, "too many tools");
        require(toolCallIds.length == toolCalls.length, "tool array mismatch");

        pipe.totalPendingTools = uint8(toolCallIds.length);
        pipe.completedTools = 0;

        delete pipe.savedRoles;
        delete pipe.savedMessages;
        delete pipe.toolCallIds;
        delete pipe.toolResults;
        delete pipe.toolRequestIds;

        for (uint256 i = 0; i < updRoles.length; i++) {
            pipe.savedRoles.push(updRoles[i]);
            pipe.savedMessages.push(updMessages[i]);
        }
        for (uint256 i = 0; i < toolCallIds.length; i++) {
            pipe.toolCallIds.push(toolCallIds[i]);
            pipe.toolResults.push("");
            pipe.toolRequestIds.push(0);
        }

        emit ToolYielded(marketId, pipe.iteration, uint8(toolCallIds.length));

        uint256 cachedDeposit = getDeposit();
        for (uint8 i = 0; i < uint8(toolCallIds.length); i++) {
            _executeToolCall(marketId, i, toolCalls[i], cachedDeposit);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOL EXECUTION
    // ═══════════════════════════════════════════════════════════════

    function _executeToolCall(uint256 marketId, uint8 toolIdx, bytes memory calldata_, uint256 deposit) internal {
        try this.routeAndDispatch(marketId, toolIdx, calldata_, deposit) {
            // dispatched
        } catch {
            PipelineState storage pipe = _pipeline[marketId];
            pipe.toolResults[toolIdx] = "ERROR: tool routing failed";
            pipe.completedTools++;
            _checkAllToolsDone(marketId);
        }
    }

    /// @dev External for try/catch — routes tool calldata and dispatches to JSON agent
    function routeAndDispatch(uint256 marketId, uint8 toolIdx, bytes memory calldata_, uint256 deposit) external {
        require(msg.sender == address(this), "internal only");

        (string memory url, string memory selector) = calldata_.routeToolCall();

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector, url, selector
        );

        uint256 reqId = _platform.createRequest{value: deposit}(
            JSON_AGENT_ID, address(this), this.onToolResult.selector, payload
        );

        _reqToMarket[reqId] = marketId;
        _reqToToolIdx[reqId] = toolIdx;
        _pipeline[marketId].toolRequestIds[toolIdx] = reqId;
    }

    // ═══════════════════════════════════════════════════════════════
    // CALLBACK: Tool execution result
    // ═══════════════════════════════════════════════════════════════

    /// @notice Callback from platform after JSON agent fetch completes
    function onToolResult(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == PLATFORM_ADDR, "only platform");
        if (_requestConsumed[requestId]) return;
        _requestConsumed[requestId] = true;

        uint256 marketId = _reqToMarket[requestId];
        uint8 toolIdx = _reqToToolIdx[requestId];
        PipelineState storage pipe = _pipeline[marketId];

        if (pipe.phase != Phase.ExecutingTools) return;

        string memory result;
        if (status == ResponseStatus.Success && responses.length > 0) {
            try this.decodeStringResult(responses[0].result) returns (string memory decoded) {
                result = decoded;
            } catch {
                result = "ERROR: decode failed";
            }
        } else {
            result = "ERROR: fetch failed";
        }

        pipe.toolResults[toolIdx] = result;
        pipe.completedTools++;

        emit ToolExecuted(marketId, pipe.toolCallIds[toolIdx], result);
        _checkAllToolsDone(marketId);
    }

    /// @dev External decoder for try/catch
    function decodeStringResult(bytes memory data) external pure returns (string memory) {
        return abi.decode(data, (string));
    }

    // ═══════════════════════════════════════════════════════════════
    // RESUME
    // ═══════════════════════════════════════════════════════════════

    function _checkAllToolsDone(uint256 marketId) internal {
        PipelineState storage pipe = _pipeline[marketId];
        if (pipe.phase != Phase.ExecutingTools) return;
        if (pipe.completedTools < pipe.totalPendingTools) return;

        pipe.phase = Phase.Resuming;
        _resumeOrchestration(marketId);
    }

    function _resumeOrchestration(uint256 marketId) internal {
        PipelineState storage pipe = _pipeline[marketId];

        uint256 baseLen = pipe.savedRoles.length;
        uint256 toolCount = pipe.toolCallIds.length;
        uint256 totalLen = baseLen + toolCount;

        string[] memory roles = new string[](totalLen);
        string[] memory messages = new string[](totalLen);

        for (uint256 i = 0; i < baseLen; i++) {
            roles[i] = pipe.savedRoles[i];
            messages[i] = pipe.savedMessages[i];
        }

        for (uint256 i = 0; i < toolCount; i++) {
            roles[baseLen + i] = "tool";
            messages[baseLen + i] = string(abi.encodePacked(
                '{"tool_call_id":"', pipe.toolCallIds[i],
                '","content":"', pipe.toolResults[i], '"}'
            ));
        }

        emit ResumeTriggered(marketId, pipe.iteration);

        _dispatchInferToolsChat(marketId, roles, messages, pipe.isResolve);
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZATION
    // ═══════════════════════════════════════════════════════════════

    function _finalizePipeline(uint256 marketId, string memory response) internal {
        _pipeline[marketId].phase = Phase.Done;
        _onFinalResponse(marketId, response);
        _cleanupPipeline(marketId);
    }

    /// @dev Reclaim storage after pipeline completes
    function _cleanupPipeline(uint256 marketId) internal {
        PipelineState storage pipe = _pipeline[marketId];
        delete pipe.savedRoles;
        delete pipe.savedMessages;
        delete pipe.toolCallIds;
        delete pipe.toolResults;
        delete pipe.toolRequestIds;
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════════

    /// @notice Get pipeline state for a market
    function getPipeline(uint256 marketId) external view returns (
        uint8 phase, uint8 iteration, uint8 totalPending, uint8 completed
    ) {
        PipelineState storage p = _pipeline[marketId];
        return (uint8(p.phase), p.iteration, p.totalPendingTools, p.completedTools);
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════

    function _buildTools() internal pure returns (OnchainTool[] memory tools) {
        tools = new OnchainTool[](4);
        tools[0] = OnchainTool(
            "fetchPrice(string symbol)",
            "Fetch current USD price of a cryptocurrency (e.g. BTC, ETH, SOL, DOGE, XRP)"
        );
        tools[1] = OnchainTool(
            "fetchSportsFixture(string league)",
            "Fetch next upcoming fixture for a sports league (e.g. MLS, EPL, La Liga, NBA, NFL)"
        );
        tools[2] = OnchainTool(
            "fetchHeadline(string topic)",
            "Fetch trending information about a topic from GitHub"
        );
        tools[3] = OnchainTool(
            "fetchJSON(string url, string selector)",
            "Fetch any JSON API and extract a value using dot-notation selector"
        );
    }

    function _isStop(string memory fr) internal pure returns (bool) {
        return keccak256(bytes(fr)) == keccak256("stop");
    }

    function _isToolCalls(string memory fr) internal pure returns (bool) {
        return keccak256(bytes(fr)) == keccak256("tool_calls");
    }
}
