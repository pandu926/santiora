// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title TestToolsChatDebug — Multiple variations to find working config
contract TestToolsChatDebug {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;

    struct Result {
        bool received;
        uint8 status;
        bytes rawResult;
        uint256 timestamp;
    }

    mapping(uint256 => Result) public results;
    mapping(uint256 => string) public testLabel;
    uint256[] public requestIds;

    event Sent(string label, uint256 requestId, uint256 deposit);
    event Received(uint256 indexed requestId, uint8 status, uint256 resultLen);

    receive() external payable {}

    // Test A: Higher deposit (0.48 STT)
    function testHighDeposit() external returns (uint256) {
        uint256 deposit = 48e16; // 0.48 STT
        return _sendRequest("highDeposit_0.48", deposit, 1, true);
    }

    // Test B: maxIterations = 0
    function testZeroIterations() external returns (uint256) {
        uint256 deposit = 24e16;
        return _sendRequest("maxIter_0", deposit, 0, true);
    }

    // Test C: chainOfThought = false
    function testNoCOT() external returns (uint256) {
        uint256 deposit = 24e16;
        return _sendRequest("noCOT", deposit, 1, false);
    }

    // Test D: Very high deposit (1 STT) + maxIterations=0 + no COT
    function testMaxDeposit() external returns (uint256) {
        uint256 deposit = 1 ether;
        return _sendRequest("maxDeposit_1STT_iter0_noCOT", deposit, 0, false);
    }

    function _sendRequest(string memory label, uint256 deposit, uint256 maxIter, bool cot) internal returns (uint256) {
        require(address(this).balance >= deposit, "Insufficient");

        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";

        string[] memory messages = new string[](2);
        messages[0] = "Return only: hello";
        messages[1] = "Say hello";

        string[] memory mcpUrls = new string[](0);
        bytes[] memory tools = new bytes[](0);

        bytes memory payload = abi.encodeWithSelector(
            IToolsAgent.inferToolsChat.selector,
            roles, messages, mcpUrls, tools, maxIter, cot
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: deposit}(
            LLM_AGENT_ID, address(this), this.onResponse.selector, payload
        );

        testLabel[reqId] = label;
        requestIds.push(reqId);
        emit Sent(label, reqId, deposit);
        return reqId;
    }

    function onResponse(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external {
        require(msg.sender == PLATFORM, "Only platform");

        bytes memory raw;
        if (status == ResponseStatus.Success && responses.length > 0) {
            raw = responses[0].result;
        }
        results[requestId] = Result(true, uint8(status), raw, block.timestamp);
        emit Received(requestId, uint8(status), raw.length);
    }

    function getRequestCount() external view returns (uint256) {
        return requestIds.length;
    }

    function getResult(uint256 reqId) external view returns (bool received, uint8 status, uint256 rawLen, string memory label) {
        Result storage r = results[reqId];
        return (r.received, r.status, r.rawResult.length, testLabel[reqId]);
    }

    function getRawResult(uint256 reqId) external view returns (bytes memory) {
        return results[reqId].rawResult;
    }
}
