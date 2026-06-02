// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

interface ISantioraFinalV3CreateSink {
    function finalizeCreated(uint256 marketId, string calldata question, uint256 odds, uint256 deadline, string calldata sourceUrl, string calldata selector, string calldata data) external;
    function rejectCreated(uint256 marketId, string calldata reason) external;
}

interface IMarketRegistryV2Read {
    function getRecentQuestions(uint256 count) external view returns (string[] memory);
}

/// @title SantioraV3Creator — Agentic creation pipeline module
/// @notice Fetches real data, asks LLM to create market, then asks quality gate before finalizing to coordinator.
contract SantioraV3Creator {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant LLM_DEPOSIT = 33e16;
    uint256 public constant JSON_DEPOSIT = 12e16;

    uint8 private constant REQ_NEWS = 1;
    uint8 private constant REQ_CREATE = 2;
    uint8 private constant REQ_QUALITY = 3;

    struct Draft {
        uint256 marketId;
        string category;
        string sourceUrl;
        string selector;
        string data;
        string question;
        uint256 odds;
        uint256 deadline;
        uint8 retryCount;
    }

    address public immutable coordinator;
    IMarketRegistryV2Read public immutable registry;
    address public owner;
    uint256 public maxRetry = 3;
    uint256 public minDuration = 1 days;
    uint256 public maxDuration = 7 days;
    uint256 public nextSourceIndex;

    mapping(uint256 => Draft) public drafts;
    mapping(uint256 => uint256) public requestToMarket;
    mapping(uint256 => uint8) public requestType;
    mapping(uint256 => bool) public requestExists;

    event CreatorStarted(uint256 indexed marketId, string category, string sourceUrl);
    event CreatorData(uint256 indexed marketId, string data);
    event CreatorBrain(uint256 indexed marketId, string response);
    event CreatorQuality(uint256 indexed marketId, bool approved, string response);
    event CreatorFailed(uint256 indexed marketId, string reason);

    modifier onlyCoordinator() {
        require(msg.sender == coordinator, "Only coordinator");
        _;
    }

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address coordinatorAddress, address registryAddress) {
        require(coordinatorAddress != address(0) && registryAddress != address(0), "Zero address");
        coordinator = coordinatorAddress;
        registry = IMarketRegistryV2Read(registryAddress);
        owner = msg.sender;
    }

    receive() external payable {}

    function configure(uint256 nextMaxRetry, uint256 nextMinDuration, uint256 nextMaxDuration) external onlyOwner {
        maxRetry = nextMaxRetry;
        minDuration = nextMinDuration;
        maxDuration = nextMaxDuration;
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function startCreate(uint256 marketId, string calldata category) external onlyCoordinator {
        (string memory url, string memory selector) = _source(category);
        drafts[marketId] = Draft(marketId, category, url, selector, "", "", 50, block.timestamp + minDuration, 0);
        emit CreatorStarted(marketId, category, url);
        _fetchNews(marketId);
    }

    function onNews(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_NEWS);
        if (!valid) return;
        Draft storage draft = drafts[marketId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            _retryOrReject(marketId, REQ_NEWS, "news_failed");
            return;
        }
        draft.data = abi.decode(responses[0].result, (string));
        emit CreatorData(marketId, draft.data);
        _askCreate(marketId);
    }

    function onCreate(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_CREATE);
        if (!valid) return;
        if (status != ResponseStatus.Success || responses.length == 0) {
            _retryOrReject(marketId, REQ_CREATE, "create_failed");
            return;
        }
        string memory response = _decodeChat(responses[0].result);
        Draft storage draft = drafts[marketId];
        draft.question = _fallback(_jsonString(response, "question"), response);
        draft.odds = _bound(_fallbackUint(_jsonUint(response, "odds"), 50), 1, 99);
        draft.deadline = block.timestamp + _bound(_jsonUint(response, "deadline_hours") * 1 hours, minDuration, maxDuration);
        emit CreatorBrain(marketId, response);
        _askQuality(marketId);
    }

    function onQuality(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_QUALITY);
        if (!valid) return;
        if (status != ResponseStatus.Success || responses.length == 0) {
            _retryOrReject(marketId, REQ_QUALITY, "quality_failed");
            return;
        }

        string memory response = _decodeChat(responses[0].result);
        bool approved = _approved(response);
        emit CreatorQuality(marketId, approved, response);
        if (!approved) {
            _reject(marketId, "quality_rejected");
            return;
        }

        Draft storage draft = drafts[marketId];
        string memory improved = _jsonString(response, "improved_question");
        if (bytes(improved).length > 0) draft.question = improved;

        ISantioraFinalV3CreateSink(coordinator).finalizeCreated(
            marketId,
            draft.question,
            draft.odds,
            draft.deadline,
            draft.sourceUrl,
            draft.selector,
            draft.data
        );
    }

    function _fetchNews(uint256 marketId) internal {
        Draft storage draft = drafts[marketId];
        require(address(this).balance >= JSON_DEPOSIT, "Need JSON funds");
        bytes memory payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, draft.sourceUrl, draft.selector);
        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(JSON_API_AGENT_ID, address(this), this.onNews.selector, payload);
        _track(reqId, marketId, REQ_NEWS);
    }

    function _askCreate(uint256 marketId) internal {
        Draft storage draft = drafts[marketId];
        _ask(
            marketId,
            REQ_CREATE,
            this.onCreate.selector,
            "Create a YES/NO prediction market question. CRITICAL: Use the 'now' unix timestamp provided in this system message as the current time. Question MUST reference a FUTURE date (use now + deadline_hours seconds, format as 'by [date] UTC'). NEVER use past dates. Reply ONLY valid JSON: {\"question\":\"...\",\"odds\":50,\"deadline_hours\":48}. Keep deadline_hours between 24 and 168.",
            string.concat("Category: ", draft.category, ". Current data value: ", draft.data, ". Avoid duplicating: ", _recent())
        );
    }

    function _askQuality(uint256 marketId) internal {
        Draft storage draft = drafts[marketId];
        _ask(
            marketId,
            REQ_QUALITY,
            this.onQuality.selector,
            "Quality check this prediction market question. Is it specific, verifiable, time-bound, and interesting? Reply ONLY valid JSON: {\"approved\":true,\"reason\":\"...\",\"improved_question\":\"...\"}. Approve if reasonably good. Only reject if fundamentally flawed.",
            string.concat("Question: ", draft.question, ". Source data: ", draft.data, ". Existing markets: ", _recent())
        );
    }

    function _ask(uint256 marketId, uint8 reqType, bytes4 callback, string memory system, string memory user) internal {
        require(address(this).balance >= LLM_DEPOSIT, "Need LLM funds");
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";
        string[] memory messages = new string[](2);
        messages[0] = string.concat(system, " Current date is ", _dateStr(block.timestamp), " (year 2026). Do NOT use 2023, 2024, or 2025 in any answer.");
        messages[1] = user;
        string[] memory mcp = new string[](0);
        OnchainTool[] memory tools = new OnchainTool[](0);
        bytes memory payload = abi.encodeWithSelector(IToolsAgent.inferToolsChat.selector, roles, messages, mcp, tools, uint256(0), false);
        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(LLM_AGENT_ID, address(this), callback, payload);
        _track(reqId, marketId, reqType);
    }

    function _retryOrReject(uint256 marketId, uint8 reqType, string memory reason) internal {
        Draft storage draft = drafts[marketId];
        draft.retryCount++;
        if (draft.retryCount >= maxRetry) {
            _reject(marketId, reason);
            return;
        }
        if (reqType == REQ_NEWS) {
            (string memory url, string memory selector) = _fallbackSource(draft.category, draft.retryCount);
            draft.sourceUrl = url;
            draft.selector = selector;
            _fetchNews(marketId);
        } else if (reqType == REQ_CREATE) _askCreate(marketId);
        else _askQuality(marketId);
    }

    function _reject(uint256 marketId, string memory reason) internal {
        emit CreatorFailed(marketId, reason);
        ISantioraFinalV3CreateSink(coordinator).rejectCreated(marketId, reason);
    }

    function _track(uint256 requestId, uint256 marketId, uint8 reqType) internal {
        requestToMarket[requestId] = marketId;
        requestType[requestId] = reqType;
        requestExists[requestId] = true;
    }

    function _consume(uint256 requestId, uint8 expectedType) internal returns (bool valid, uint256 marketId) {
        if (!requestExists[requestId] || requestType[requestId] != expectedType) return (false, 0);
        marketId = requestToMarket[requestId];
        delete requestExists[requestId];
        delete requestToMarket[requestId];
        delete requestType[requestId];
        return (true, marketId);
    }

    function _source(string memory category) internal returns (string memory, string memory) {
        if (_same(category, "sports")) {
            uint256 index = nextSourceIndex % 3;
            nextSourceIndex++;
            return _sportsSource(index);
        }
        if (_same(category, "crypto")) {
            uint256 idx = nextSourceIndex % 4;
            nextSourceIndex++;
            return _cryptoSource(idx);
        }
        if (_same(category, "technology") || _same(category, "tech")) return ("https://api.github.com/search/repositories?q=created:>2026-05-25&sort=stars&order=desc&per_page=3", "items[0].full_name");
        if (_same(category, "finance")) return ("https://open.er-api.com/v6/latest/USD", "rates.EUR");
        return _sportsSource(0);
    }

    function _cryptoSource(uint256 idx) internal pure returns (string memory, string memory) {
        if (idx == 1) return ("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", "ethereum.usd");
        if (idx == 2) return ("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", "solana.usd");
        if (idx == 3) return ("https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd", "cardano.usd");
        return ("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", "bitcoin.usd");
    }

    function _fallbackSource(string memory category, uint256 retryCount) internal pure returns (string memory, string memory) {
        if (_same(category, "sports")) return _sportsSource(retryCount % 3);
        if (_same(category, "crypto")) return ("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd&include_24hr_change=true", "ethereum.usd");
        if (_same(category, "technology") || _same(category, "tech")) return ("https://api.github.com/search/repositories?q=topic:ai&sort=updated&order=desc&per_page=3", "items[0].full_name");
        if (_same(category, "finance")) return ("https://open.er-api.com/v6/latest/EUR", "rates.USD");
        return _sportsSource(retryCount % 3);
    }

    function _sportsSource(uint256 index) internal pure returns (string memory, string memory) {
        if (index == 1) return ("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4387", "events[0].strEvent");
        if (index == 2) return ("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4391", "events[0].strEvent");
        return ("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328", "events[0].strEvent");
    }

    function _recent() internal view returns (string memory) {
        try registry.getRecentQuestions(8) returns (string[] memory questions) {
            string memory out = "";
            for (uint256 i = 0; i < questions.length; i++) out = string.concat(out, questions[i], "; ");
            return out;
        } catch {
            return "";
        }
    }

    function _decodeChat(bytes memory result) internal pure returns (string memory response) {
        (, response,,,,) = abi.decode(result, (string, string, string[], string[], string[], bytes[]));
    }

    function _jsonString(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":"'));
        uint256 start = _find(data, needle);
        if (start == type(uint256).max) return "";
        start += needle.length;
        uint256 end = start;
        while (end < data.length && data[end] != '"') end++;
        return _slice(data, start, end);
    }

    function _jsonUint(string memory json, string memory key) internal pure returns (uint256) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = _find(data, needle);
        if (start == type(uint256).max) return 0;
        start += needle.length;
        while (start < data.length && (data[start] < '0' || data[start] > '9')) start++;
        uint256 value;
        while (start < data.length && data[start] >= '0' && data[start] <= '9') {
            value = value * 10 + uint8(data[start]) - 48;
            start++;
        }
        return value;
    }

    function _approved(string memory response) internal pure returns (bool) {
        return _find(bytes(response), '"approved":true') != type(uint256).max || _find(bytes(response), '"approved": true') != type(uint256).max;
    }

    function _fallback(string memory value, string memory fallbackValue) internal pure returns (string memory) {
        return bytes(value).length == 0 ? fallbackValue : value;
    }

    function _fallbackUint(uint256 value, uint256 fallbackValue) internal pure returns (uint256) {
        return value == 0 ? fallbackValue : value;
    }

    function _bound(uint256 value, uint256 minValue, uint256 maxValue) internal pure returns (uint256) {
        if (value < minValue) return minValue;
        if (value > maxValue) return maxValue;
        return value;
    }

    function _find(bytes memory haystack, bytes memory needle) internal pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return type(uint256).max;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool matched = true;
            for (uint256 j = 0; j < needle.length; j++) if (haystack[i + j] != needle[j]) { matched = false; break; }
            if (matched) return i;
        }
        return type(uint256).max;
    }

    function _slice(bytes memory data, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory out = new bytes(end - start);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[start + i];
        return string(out);
    }

    function _same(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }

    function _dateStr(uint256 ts) internal pure returns (string memory) {
        uint256 daysSince = ts / 86400;
        uint256 year = 1970;
        uint256 daysInYear;
        while (true) {
            daysInYear = _isLeap(year) ? 366 : 365;
            if (daysSince < daysInYear) break;
            daysSince -= daysInYear;
            year++;
        }
        uint8[12] memory mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (_isLeap(year)) mdays[1] = 29;
        uint256 month = 0;
        while (daysSince >= mdays[month]) { daysSince -= mdays[month]; month++; }
        return string.concat(_uint2str(year), "-", _pad2(month + 1), "-", _pad2(daysSince + 1));
    }

    function _isLeap(uint256 y) internal pure returns (bool) {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    function _pad2(uint256 n) internal pure returns (string memory) {
        if (n < 10) return string.concat("0", _uint2str(n));
        return _uint2str(n);
    }
}
