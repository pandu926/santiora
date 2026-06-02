// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

contract TestDomains {
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

    function _send(string memory key, string memory desc, string memory prompt, string memory url, bool resolve, string memory label) internal {
        string[] memory options = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            key, desc, options, prompt, url, resolve, uint8(1), uint8(60)
        );
        uint256 reqId = PLATFORM.createRequest{value: getDeposit()}(
            PARSE_AGENT_ID, address(this), this.onResult.selector, payload
        );
        results[reqId].label = label;
        requestIds.push(reqId);
        emit RequestSent(reqId, label);
    }

    // Sports domains
    function testESPN() external {
        _send("sport_headline", "Latest sports headline", "What is the top sports headline right now?", "espn.com", true, "ESPN search");
    }

    function testBBCSport() external {
        _send("sport_headline", "Latest sports headline", "What is the top sports headline right now?", "https://www.bbc.com/sport", false, "BBC Sport direct");
    }

    function testSkySports() external {
        _send("sport_headline", "Latest sports headline", "What is the top sports headline right now?", "skysports.com", true, "SkySports search");
    }

    // Crypto domains
    function testCoinMarketCap() external {
        _send("top_crypto", "Top cryptocurrency by market cap", "What is the #1 cryptocurrency and its current price?", "coinmarketcap.com", true, "CoinMarketCap search");
    }

    function testCryptoNews() external {
        _send("crypto_news", "Latest crypto news headline", "What is the biggest crypto news today?", "coindesk.com", true, "CoinDesk search");
    }

    // Tech domains
    function testTechCrunch() external {
        _send("tech_headline", "Latest tech headline", "What is the top tech news headline today?", "techcrunch.com", true, "TechCrunch search");
    }

    function testTheVerge() external {
        _send("tech_headline", "Latest tech headline", "What is the top tech news headline today?", "theverge.com", true, "TheVerge search");
    }

    // Finance domains
    function testReuters() external {
        _send("finance_headline", "Latest finance headline", "What is the top financial news headline today?", "reuters.com", true, "Reuters search");
    }

    function testCNBC() external {
        _send("finance_headline", "Latest finance headline", "What is the top financial news headline today?", "cnbc.com", true, "CNBC search");
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
