// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

interface ISantioraFinalV3ResolveSink {
    function finalizeResolved(uint256 marketId, string calldata outcome, uint256 confidence, string calldata data) external;
    function rejectResolution(uint256 marketId, string calldata reason) external;
}

/// @title SantioraV3Resolver — 3-agent outcome resolution module
/// @notice Fetches outcome data, resolver LLM decides, verifier checks, tiebreaker handles disagreement.
contract SantioraV3Resolver {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant LLM_DEPOSIT = 33e16;
    uint256 public constant JSON_DEPOSIT = 12e16;

    uint8 private constant REQ_DATA = 1;
    uint8 private constant REQ_RESOLVER = 2;
    uint8 private constant REQ_VERIFIER = 3;
    uint8 private constant REQ_TIEBREAKER = 4;

    struct CaseFile {
        uint256 marketId;
        string question;
        string category;
        string sourceUrl;
        string selector;
        string data;
        string resolver;
        string verifier;
        uint8 retryCount;
    }

    address public immutable coordinator;
    address public owner;
    uint256 public maxRetry = 3;

    mapping(uint256 => CaseFile) public casesByMarket;
    mapping(uint256 => uint256) public requestToMarket;
    mapping(uint256 => uint8) public requestType;
    mapping(uint256 => bool) public requestExists;

    event ResolverStarted(uint256 indexed marketId, string sourceUrl);
    event ResolverData(uint256 indexed marketId, string data);
    event ResolverBrain(uint256 indexed marketId, string phase, string response);
    event ResolverFinal(uint256 indexed marketId, string outcome, uint256 confidence);
    event ResolverFailed(uint256 indexed marketId, string reason);

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

    constructor(address coordinatorAddress) {
        require(coordinatorAddress != address(0), "Zero coordinator");
        coordinator = coordinatorAddress;
        owner = msg.sender;
    }

    receive() external payable {}

    function configure(uint256 nextMaxRetry) external onlyOwner {
        maxRetry = nextMaxRetry;
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function startResolve(
        uint256 marketId,
        string calldata question,
        string calldata category,
        string calldata sourceUrl,
        string calldata selector
    ) external onlyCoordinator {
        casesByMarket[marketId] = CaseFile(marketId, question, category, sourceUrl, selector, "", "", "", 0);
        emit ResolverStarted(marketId, sourceUrl);
        _fetchData(marketId);
    }

    function onData(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_DATA);
        if (!valid) return;
        CaseFile storage cf = casesByMarket[marketId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            _retryOrReject(marketId, REQ_DATA, "data_failed");
            return;
        }
        cf.data = abi.decode(responses[0].result, (string));
        emit ResolverData(marketId, cf.data);
        _askResolver(marketId);
    }

    function onResolver(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_RESOLVER);
        if (!valid) return;
        if (status != ResponseStatus.Success || responses.length == 0) {
            _retryOrReject(marketId, REQ_RESOLVER, "resolver_failed");
            return;
        }
        string memory response = _decodeChat(responses[0].result);
        casesByMarket[marketId].resolver = response;
        emit ResolverBrain(marketId, "resolver", response);
        _askVerifier(marketId);
    }

    function onVerifier(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_VERIFIER);
        if (!valid) return;
        CaseFile storage cf = casesByMarket[marketId];
        if (status != ResponseStatus.Success || responses.length == 0) {
            _finalize(marketId, cf.resolver, 70, true);
            return;
        }
        string memory response = _decodeChat(responses[0].result);
        cf.verifier = response;
        emit ResolverBrain(marketId, "verifier", response);
        if (_same(_outcome(cf.resolver), _outcome(response))) {
            _finalize(marketId, cf.resolver, 95, true);
        } else {
            _askTiebreaker(marketId);
        }
    }

    function onTiebreaker(uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory) external onlyPlatform {
        (bool valid, uint256 marketId) = _consume(requestId, REQ_TIEBREAKER);
        if (!valid) return;
        if (status != ResponseStatus.Success || responses.length == 0) {
            _reject(marketId, "tiebreaker_failed");
            return;
        }
        string memory response = _decodeChat(responses[0].result);
        emit ResolverBrain(marketId, "tiebreaker", response);
        _finalize(marketId, response, 80, false);
    }

    function _fetchData(uint256 marketId) internal {
        CaseFile storage cf = casesByMarket[marketId];
        require(address(this).balance >= JSON_DEPOSIT, "Need JSON funds");
        bytes memory payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, cf.sourceUrl, cf.selector);
        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(JSON_API_AGENT_ID, address(this), this.onData.selector, payload);
        _track(reqId, marketId, REQ_DATA);
    }

    function _askResolver(uint256 marketId) internal {
        CaseFile storage cf = casesByMarket[marketId];
        _ask(marketId, REQ_RESOLVER, this.onResolver.selector, "Resolve from data only. JSON: outcome YES/NO, confidence, reasoning.", string.concat(cf.question, " data: ", cf.data));
    }

    function _askVerifier(uint256 marketId) internal {
        CaseFile storage cf = casesByMarket[marketId];
        _ask(marketId, REQ_VERIFIER, this.onVerifier.selector, "Verify independently. JSON: outcome YES/NO, confidence, reasoning.", string.concat(cf.question, " data: ", cf.data, " resolver: ", cf.resolver));
    }

    function _askTiebreaker(uint256 marketId) internal {
        CaseFile storage cf = casesByMarket[marketId];
        _ask(marketId, REQ_TIEBREAKER, this.onTiebreaker.selector, "Final arbiter. JSON: outcome YES/NO, confidence, reasoning.", string.concat(cf.question, " data: ", cf.data, " r: ", cf.resolver, " v: ", cf.verifier));
    }

    function _ask(uint256 marketId, uint8 reqType, bytes4 callback, string memory system, string memory user) internal {
        require(address(this).balance >= LLM_DEPOSIT, "Need LLM funds");
        string[] memory roles = new string[](2);
        roles[0] = "system";
        roles[1] = "user";
        string[] memory messages = new string[](2);
        messages[0] = system;
        messages[1] = user;
        string[] memory mcp = new string[](0);
        OnchainTool[] memory tools = new OnchainTool[](0);
        bytes memory payload = abi.encodeWithSelector(IToolsAgent.inferToolsChat.selector, roles, messages, mcp, tools, uint256(0), false);
        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(LLM_AGENT_ID, address(this), callback, payload);
        _track(reqId, marketId, reqType);
    }

    function _retryOrReject(uint256 marketId, uint8 reqType, string memory reason) internal {
        CaseFile storage cf = casesByMarket[marketId];
        cf.retryCount++;
        if (cf.retryCount >= maxRetry) {
            _reject(marketId, reason);
            return;
        }
        if (reqType == REQ_DATA) _fetchData(marketId);
        else if (reqType == REQ_RESOLVER) _askResolver(marketId);
        else if (reqType == REQ_VERIFIER) _askVerifier(marketId);
        else _askTiebreaker(marketId);
    }

    function _finalize(uint256 marketId, string memory response, uint256 fallbackConfidence, bool forceConfidence) internal {
        string memory finalOutcome = _outcome(response);
        uint256 confidence = forceConfidence ? fallbackConfidence : _bound(_fallbackUint(_jsonUint(response, "confidence"), fallbackConfidence), 60, 100);
        emit ResolverFinal(marketId, finalOutcome, confidence);
        ISantioraFinalV3ResolveSink(coordinator).finalizeResolved(marketId, finalOutcome, confidence, response);
    }

    function _reject(uint256 marketId, string memory reason) internal {
        emit ResolverFailed(marketId, reason);
        ISantioraFinalV3ResolveSink(coordinator).rejectResolution(marketId, reason);
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

    function _decodeChat(bytes memory result) internal pure returns (string memory response) {
        (, response,,,,) = abi.decode(result, (string, string, string[], string[], string[], bytes[]));
    }

    function _outcome(string memory response) internal pure returns (string memory) {
        string memory value = _jsonString(response, "outcome");
        if (_same(value, "YES") || _contains(response, '"YES"')) return "YES";
        return "NO";
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

    function _fallbackUint(uint256 value, uint256 fallbackValue) internal pure returns (uint256) {
        return value == 0 ? fallbackValue : value;
    }

    function _bound(uint256 value, uint256 minValue, uint256 maxValue) internal pure returns (uint256) {
        if (value < minValue) return minValue;
        if (value > maxValue) return maxValue;
        return value;
    }

    function _contains(string memory haystack, bytes memory needle) internal pure returns (bool) {
        return _find(bytes(haystack), needle) != type(uint256).max;
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
}
