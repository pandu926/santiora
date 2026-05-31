// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title TestToolsFinal — Test inferToolsChat with correct encoding
/// @dev Uses raw bytes payload to match exact viem tuple[] encoding
contract TestToolsFinal {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant DEPOSIT = 24e16;

    struct Result {
        bool received;
        uint8 status;
        bytes rawResult;
        uint256 timestamp;
    }

    Result public toolsResult;
    uint256 public toolsRequestId;

    event Sent(uint256 requestId, bytes4 selector);
    event Received(uint256 indexed requestId, uint8 status, uint256 resultLen);
    event RawCallback(uint256 requestId, uint8 status, uint256 responseCount);

    receive() external payable {}

    /// @notice Send inferToolsChat with pre-encoded payload from TypeScript
    function sendRawPayload(bytes calldata payload) external returns (uint256) {
        require(address(this).balance >= DEPOSIT, "Fund me");

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: DEPOSIT}(
            LLM_AGENT_ID, address(this), this.onResponse.selector, payload
        );
        toolsRequestId = reqId;
        bytes4 sel = bytes4(payload[0]) | (bytes4(payload[1]) >> 8) | (bytes4(payload[2]) >> 16) | (bytes4(payload[3]) >> 24);
        emit Sent(reqId, sel);
        return reqId;
    }

    function onResponse(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external {
        require(msg.sender == PLATFORM, "Only platform");
        emit RawCallback(requestId, uint8(status), responses.length);

        bytes memory raw;
        if (status == ResponseStatus.Success && responses.length > 0) {
            raw = responses[0].result;
        }
        toolsResult = Result(true, uint8(status), raw, block.timestamp);
        emit Received(requestId, uint8(status), raw.length);
    }

    function getResult() external view returns (bool received, uint8 status, uint256 rawLen) {
        return (toolsResult.received, toolsResult.status, toolsResult.rawResult.length);
    }

    function getRawResult() external view returns (bytes memory) {
        return toolsResult.rawResult;
    }
}
