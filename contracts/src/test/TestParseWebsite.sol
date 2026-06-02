// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

contract TestParseWebsite {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant PARSE_AGENT_ID = 12875401142070969085;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant PER_AGENT_EXECUTION_COST = 100000000000000000; // 0.1 STT

    uint256 public extractStringReqId;
    uint256 public extractNumberReqId;

    bool public stringReceived;
    string public stringResult;
    uint8 public stringStatus;

    bool public numberReceived;
    uint256 public numberResult;
    uint8 public numberStatus;

    event RequestSent(string method, uint256 requestId);
    event StringResponse(uint256 requestId, string result, uint8 status);
    event NumberResponse(uint256 requestId, uint256 result, uint8 status);

    receive() external payable {}

    function getDeposit() public view returns (uint256) {
        uint256 reserve = PLATFORM.getRequestDeposit();
        uint256 reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
        return reserve + reward;
    }

    function testExtractString() external {
        string[] memory options = new string[](0);

        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "nba_headline",
            "The most recent NBA game result or upcoming game",
            options,
            "What is the latest NBA game result or next scheduled game?",
            "espn.com",
            true,           // resolveUrl = search domain
            uint8(2),       // numPages
            uint8(70)       // confidenceThreshold
        );

        uint256 deposit = getDeposit();
        extractStringReqId = PLATFORM.createRequest{value: deposit}(
            PARSE_AGENT_ID,
            address(this),
            this.onStringResult.selector,
            payload
        );

        emit RequestSent("ExtractString", extractStringReqId);
    }

    function testExtractANumber() external {
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractANumber.selector,
            "github_stars",
            "Number of stars on the most trending GitHub repo today",
            uint256(0),         // min
            uint256(1000000),   // max
            "How many stars does the top trending repository on GitHub have?",
            "github.com/trending",
            false,              // resolveUrl = direct URL
            uint8(1),           // numPages
            uint8(70)           // confidenceThreshold
        );

        uint256 deposit = getDeposit();
        extractNumberReqId = PLATFORM.createRequest{value: deposit}(
            PARSE_AGENT_ID,
            address(this),
            this.onNumberResult.selector,
            payload
        );

        emit RequestSent("ExtractANumber", extractNumberReqId);
    }

    function onStringResult(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "only platform");
        stringReceived = true;
        stringStatus = uint8(status);
        if (status == ResponseStatus.Success && responses.length > 0) {
            stringResult = abi.decode(responses[0].result, (string));
        }
        emit StringResponse(requestId, stringResult, uint8(status));
    }

    function onNumberResult(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "only platform");
        numberReceived = true;
        numberStatus = uint8(status);
        if (status == ResponseStatus.Success && responses.length > 0) {
            numberResult = abi.decode(responses[0].result, (uint256));
        }
        emit NumberResponse(requestId, numberResult, uint8(status));
    }
}
