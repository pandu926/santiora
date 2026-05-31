// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title TestBothMethods — Compare inferToolsChat vs inferChat
contract TestBothMethods {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant DEPOSIT = 24e16;

    struct Result {
        bool received;
        uint8 status;
        string data;
        uint256 timestamp;
    }

    Result public toolsChatResult;
    Result public inferChatResult;
    uint256 public toolsChatRequestId;
    uint256 public inferChatRequestId;

    event Sent(string method, uint256 requestId);
    event Received(string method, uint8 status, string data);

    receive() external payable {}

    function testToolsChat() external returns (uint256) {
        require(address(this).balance >= DEPOSIT, "Fund me");

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are Santiora AI. Return only JSON.";
        messages[1] = "Say hello. Return: {\"msg\":\"hello\"}";

        string[] memory mcpUrls = new string[](0);
        bytes[] memory tools = new bytes[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, tools, uint256(1), true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onToolsChatResponse.selector, payload
        );
        toolsChatRequestId = reqId;
        emit Sent("inferToolsChat", reqId);
        return reqId;
    }

    function testInferChat() external returns (uint256) {
        require(address(this).balance >= DEPOSIT, "Fund me");

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "You are Santiora AI. Return only JSON.";
        messages[1] = "Say hello. Return: {\"msg\":\"hello\"}";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferChat.selector,
            roles, messages, true
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onInferChatResponse.selector, payload
        );
        inferChatRequestId = reqId;
        emit Sent("inferChat", reqId);
        return reqId;
    }

    function onToolsChatResponse(
        uint256, Response[] memory responses, ResponseStatus status, Request memory
    ) external {
        require(msg.sender == PLATFORM, "Only platform");

        if (status == ResponseStatus.Success && responses.length > 0) {
            (string memory finishReason, string memory response,,,,) = abi.decode(
                responses[0].result, (string, string, string[], string[], string[], bytes[])
            );
            toolsChatResult = Result(true, uint8(status), string.concat(finishReason, "|", response), block.timestamp);
            emit Received("inferToolsChat", uint8(status), response);
        } else {
            toolsChatResult = Result(true, uint8(status), "FAILED", block.timestamp);
            emit Received("inferToolsChat", uint8(status), "FAILED");
        }
    }

    function onInferChatResponse(
        uint256, Response[] memory responses, ResponseStatus status, Request memory
    ) external {
        require(msg.sender == PLATFORM, "Only platform");

        if (status == ResponseStatus.Success && responses.length > 0) {
            string memory response = abi.decode(responses[0].result, (string));
            inferChatResult = Result(true, uint8(status), response, block.timestamp);
            emit Received("inferChat", uint8(status), response);
        } else {
            inferChatResult = Result(true, uint8(status), "FAILED", block.timestamp);
            emit Received("inferChat", uint8(status), "FAILED");
        }
    }
}
