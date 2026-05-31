// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title TestInferToolsChat — Minimal contract to test inferToolsChat
contract TestInferToolsChat {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant DEPOSIT = 24e16; // 0.24 STT

    struct Result {
        bool received;
        ResponseStatus status;
        string finishReason;
        string response;
        uint256 timestamp;
    }

    mapping(uint256 => Result) public results;
    uint256 public lastRequestId;

    event RequestSent(uint256 indexed requestId, uint256 timestamp);
    event ResponseReceived(uint256 indexed requestId, string finishReason, string response);
    event ResponseFailed(uint256 indexed requestId, ResponseStatus status);

    receive() external payable {}

    function testInferToolsChat(string calldata userMessage) external returns (uint256 requestId) {
        require(address(this).balance >= DEPOSIT, "Fund me first");

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are Santiora AI. Today is May 31, 2026. Return ONLY valid JSON.";
        messages[1] = userMessage;

        string[] memory mcpUrls = new string[](0);
        bytes[] memory onchainTools = new bytes[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, onchainTools, uint256(1), true
        );

        requestId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onResponse.selector, payload
        );

        lastRequestId = requestId;
        emit RequestSent(requestId, block.timestamp);
    }

    function onResponse(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external {
        require(msg.sender == PLATFORM, "Only platform");

        if (status == ResponseStatus.Success && responses.length > 0) {
            (string memory finishReason, string memory response,,,,) = abi.decode(
                responses[0].result, (string, string, string[], string[], string[], bytes[])
            );
            results[requestId] = Result(true, status, finishReason, response, block.timestamp);
            emit ResponseReceived(requestId, finishReason, response);
        } else {
            results[requestId] = Result(true, status, "", "", block.timestamp);
            emit ResponseFailed(requestId, status);
        }
    }

    function getResult(uint256 requestId) external view returns (
        bool received, uint8 status, string memory finishReason, string memory response, uint256 timestamp
    ) {
        Result storage r = results[requestId];
        return (r.received, uint8(r.status), r.finishReason, r.response, r.timestamp);
    }
}
