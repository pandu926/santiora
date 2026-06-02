// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

contract TestDomains2 {
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

    // Sports — alternatives
    function testYahooSports() external {
        _send("sport", "Latest sports headline", "What is the top sports headline?", "sports.yahoo.com", true, "Yahoo Sports");
    }

    function testFoxSports() external {
        _send("sport", "Latest sports headline", "What is the top sports headline?", "foxsports.com", true, "Fox Sports");
    }

    function testCBSSports() external {
        _send("sport", "Latest sports headline", "What is the top sports headline?", "cbssports.com", true, "CBS Sports");
    }

    // News — general
    function testAPNews() external {
        _send("news", "Top news headline", "What is the top headline right now?", "apnews.com", true, "AP News");
    }

    function testCNN() external {
        _send("news", "Top news headline", "What is the top headline right now?", "cnn.com", true, "CNN");
    }

    function testAlJazeera() external {
        _send("news", "Top news headline", "What is the top headline right now?", "aljazeera.com", true, "Al Jazeera");
    }

    // Crypto — alternatives
    function testCryptoSlate() external {
        _send("crypto", "Latest crypto news", "What is the biggest crypto news today?", "cryptoslate.com", true, "CryptoSlate");
    }

    function testDecrypt() external {
        _send("crypto", "Latest crypto news", "What is the biggest crypto news today?", "decrypt.co", true, "Decrypt");
    }

    // Tech — alternatives
    function testArsTechnica() external {
        _send("tech", "Latest tech headline", "What is the top tech news today?", "arstechnica.com", true, "Ars Technica");
    }

    function testWired() external {
        _send("tech", "Latest tech headline", "What is the top tech news today?", "wired.com", true, "Wired");
    }

    // Finance — alternatives
    function testMarketWatch() external {
        _send("finance", "Latest market headline", "What is the top financial market news?", "marketwatch.com", true, "MarketWatch");
    }

    function testYahooFinance() external {
        _send("finance", "Latest market headline", "What is the top financial market news?", "finance.yahoo.com", true, "Yahoo Finance");
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
