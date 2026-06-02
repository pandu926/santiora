// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

contract TestDomains3 {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant PARSE_AGENT_ID = 12875401142070969085;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant PER_AGENT_EXECUTION_COST = 100000000000000000;

    struct Result {
        bool received;
        string value;
        uint8 status;
        string label;
    }

    mapping(uint256 => Result) public results;
    uint256[] public requestIds;

    event RequestSent(uint256 indexed id, string label);
    event ResponseReceived(uint256 indexed id, string value, uint8 status);

    receive() external payable {}

    function getDeposit() public view returns (uint256) {
        uint256 reserve = PLATFORM.getRequestDeposit();
        return reserve + PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
    }

    function getRequestCount() external view returns (uint256) {
        return requestIds.length;
    }

    // Lower confidence (40), test domains that returned data but FAILED
    function _send(string memory key, string memory desc, string memory prompt, string memory url, bool resolve, uint8 confidence, string memory label) internal {
        string[] memory options = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            key, desc, options, prompt, url, resolve, uint8(1), confidence
        );
        uint256 reqId = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        results[reqId].label = label;
        requestIds.push(reqId);
        emit RequestSent(reqId, label);
    }

    // Re-test CBS Sports with lower confidence
    function testCBSSports_low() external {
        _send("sport", "Latest sports headline", "What is the top sports headline?", "cbssports.com", true, uint8(40), "CBS conf=40");
    }

    // Re-test CNN with lower confidence
    function testCNN_low() external {
        _send("news", "Top news headline", "What is the top headline right now?", "cnn.com", true, uint8(40), "CNN conf=40");
    }

    // Re-test Yahoo Sports — maybe prompt too generic
    function testYahooSports_specific() external {
        _send("nba_result", "Latest NBA game result", "What was the most recent NBA game result and final score?", "sports.yahoo.com", true, uint8(40), "Yahoo NBA specific");
    }

    // Test AP News with direct URL instead of search
    function testAPNews_direct() external {
        _send("news", "Top news headline", "What is the top headline?", "https://apnews.com", false, uint8(40), "AP direct conf=40");
    }

    // Re-test Fox Sports with specific prompt
    function testFoxSports_specific() external {
        _send("nfl_news", "Latest NFL news", "What is the latest NFL news headline?", "foxsports.com", true, uint8(40), "Fox NFL conf=40");
    }

    // Test BBC with search (not direct) to compare
    function testBBC_search() external {
        _send("sport", "Latest sports headline", "What is the top sports headline?", "bbc.com/sport", true, uint8(40), "BBC search conf=40");
    }

    // Test a simple reliable site — Wikipedia current events
    function testWikiEvents() external {
        _send("event", "Current world event", "What is the most significant world event happening today?", "https://en.wikipedia.org/wiki/Portal:Current_events", false, uint8(40), "Wiki events direct");
    }

    // Test with options array — constrain output
    function testCBSSports_options() external {
        string[] memory options = new string[](3);
        options[0] = "NBA";
        options[1] = "NFL";
        options[2] = "MLB";
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "sport_type",
            "Which sport is the main headline about",
            options,
            "Which sport category is the top headline about?",
            "cbssports.com",
            true,
            uint8(1),
            uint8(40)
        );
        uint256 reqId = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        results[reqId].label = "CBS options[NBA,NFL,MLB]";
        requestIds.push(reqId);
        emit RequestSent(reqId, "CBS options");
    }

    function onResult(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == address(PLATFORM), "only platform");
        Result storage r = results[requestId];
        r.received = true;
        r.status = uint8(status);
        if (status == ResponseStatus.Success && responses.length > 0) {
            r.value = abi.decode(responses[0].result, (string));
        }
        emit ResponseReceived(requestId, r.value, uint8(status));
    }
}
