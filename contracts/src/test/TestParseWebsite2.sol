// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

contract TestParseWebsite2 {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant PARSE_AGENT_ID = 12875401142070969085;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant PER_AGENT_EXECUTION_COST = 100000000000000000;

    struct Result {
        bool received;
        string value;
        uint8 status;
    }

    mapping(uint256 => Result) public results;
    uint256 public reqId1;
    uint256 public reqId2;
    uint256 public reqId3;

    event RequestSent(uint256 indexed id, string label);
    event ResponseReceived(uint256 indexed id, string value, uint8 status);

    receive() external payable {}

    function getDeposit() public view returns (uint256) {
        uint256 reserve = PLATFORM.getRequestDeposit();
        return reserve + PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
    }

    // Test 1: Direct URL, no search — github trending page
    function test1_GithubDirect() external {
        string[] memory options = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "top_repo",
            "Name of the top trending repository on GitHub today",
            options,
            "What is the name of the #1 trending repository on GitHub today?",
            "https://github.com/trending",
            false,          // resolveUrl = false, direct scrape
            uint8(1),       // numPages
            uint8(60)       // confidenceThreshold
        );

        reqId1 = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        emit RequestSent(reqId1, "github_direct");
    }

    // Test 2: Domain search — coingecko (simpler domain)
    function test2_CoinGeckoSearch() external {
        string[] memory options = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "top_crypto",
            "Name of the #1 cryptocurrency by market cap",
            options,
            "What is the #1 cryptocurrency by market cap on CoinGecko?",
            "coingecko.com",
            true,           // resolveUrl = search domain
            uint8(1),       // numPages = 1 (lighter)
            uint8(60)       // confidenceThreshold
        );

        reqId2 = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        emit RequestSent(reqId2, "coingecko_search");
    }

    // Test 3: Direct URL — simple news site
    function test3_BBCSport() external {
        string[] memory options = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "sport_headline",
            "The main sports headline on BBC Sport",
            options,
            "What is the top headline on BBC Sport right now?",
            "https://www.bbc.com/sport",
            false,          // direct URL
            uint8(1),       // numPages
            uint8(60)       // confidenceThreshold
        );

        reqId3 = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        emit RequestSent(reqId3, "bbc_direct");
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
