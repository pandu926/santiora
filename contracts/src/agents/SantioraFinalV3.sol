// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IMarketRegistryV2Lite {
    function registerMarket(address marketAddress, string calldata question, uint256 odds, uint256 deadline, string calldata category, uint8 status, bool isSUSD) external returns (uint256);
    function updateMarket(address marketAddress, uint8 status, string calldata outcome, uint256 confidence) external;
    function isDuplicate(string calldata question) external view returns (bool);
    function hasTopicCapacity(string calldata category) external view returns (bool);
}

interface ISantioraV3Creator {
    function startCreate(uint256 marketId, string calldata category) external;
}

interface ISantioraV3Resolver {
    function startResolve(uint256 marketId, string calldata question, string calldata category, string calldata sourceUrl, string calldata selector) external;
}

/// @title SantioraFinalV3 — Modular coordinator for autonomous prediction markets
/// @notice Keeps canonical state while Creator/Resolver modules run agent pipelines.
contract SantioraFinalV3 {
    enum MarketStatus { Creating, Active, Resolving, Resolved, Failed }

    struct Rules {
        uint256 scanInterval;
        uint256 maxMarketDuration;
        uint256 minMarketDuration;
        uint256 maxMarketsPerDay;
    }

    struct RulesState {
        uint256 lastScanTimestamp;
        uint256 marketsCreatedToday;
        uint256 dayStartTimestamp;
    }

    struct Market {
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        MarketStatus status;
        string outcome;
        uint256 confidence;
        string sourceUrl;
        string selector;
        string data;
    }

    struct Performance {
        uint256 totalCreated;
        uint256 totalResolved;
        uint256 totalFailed;
        uint256 totalRejected;
        uint256 totalConfidenceSum;
    }

    IMarketRegistryV2Lite public immutable registry;
    address public owner;
    address public reactiveContract;
    address public creatorModule;
    address public resolverModule;

    Rules public rules;
    RulesState public rulesState;
    Performance public performance;
    Market[] public markets;
    string[] public categories;

    mapping(string => uint256) public categorySuccessCount;
    mapping(string => uint256) public categoryFailCount;

    event ModulesUpdated(address creator, address resolver);
    event MarketCreating(uint256 indexed marketId, string category);
    event MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline);
    event MarketResolving(uint256 indexed marketId);
    event MarketResolved(uint256 indexed marketId, string outcome, uint256 confidence);
    event PipelineFailed(uint256 indexed marketId, string reason);
    event AutoRegistered(uint256 indexed marketId, address registryAddress);
    event Decision(uint256 indexed marketId, string action, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || msg.sender == reactiveContract, "Not authorized");
        _;
    }

    modifier onlyCreator() {
        require(msg.sender == creatorModule, "Only creator");
        _;
    }

    modifier onlyResolver() {
        require(msg.sender == resolverModule, "Only resolver");
        _;
    }

    constructor(address registryAddress) {
        require(registryAddress != address(0), "Zero registry");
        registry = IMarketRegistryV2Lite(registryAddress);
        owner = msg.sender;
        rules = Rules(3600, 7 days, 1 days, 5);
        rulesState = RulesState(0, 0, block.timestamp);
        categories.push("sports");
        categories.push("crypto");
        categories.push("technology");
        categories.push("finance");
    }

    receive() external payable {}

    function setModules(address creator, address resolver) external onlyOwner {
        require(creator != address(0) && resolver != address(0), "Zero module");
        creatorModule = creator;
        resolverModule = resolver;
        emit ModulesUpdated(creator, resolver);
    }

    function setReactiveContract(address reactive) external onlyOwner {
        reactiveContract = reactive;
    }

    function updateRules(Rules calldata nextRules) external onlyOwner {
        rules = nextRules;
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function createMarket(string calldata category) external onlyAuthorized returns (uint256 marketId) {
        require(creatorModule != address(0), "Creator unset");
        _resetDayIfNeeded();
        (bool allowed, string memory reason) = _canCreate(category);
        if (!allowed) {
            emit Decision(type(uint256).max, "SKIP", reason);
            return type(uint256).max;
        }

        marketId = markets.length;
        markets.push(Market("", 50, 0, category, MarketStatus.Creating, "", 0, "", "", ""));
        rulesState.lastScanTimestamp = block.timestamp;
        rulesState.marketsCreatedToday++;

        emit MarketCreating(marketId, category);
        ISantioraV3Creator(creatorModule).startCreate(marketId, category);
    }

    function finalizeCreated(
        uint256 marketId,
        string calldata question,
        uint256 odds,
        uint256 deadline,
        string calldata sourceUrl,
        string calldata selector,
        string calldata data
    ) external onlyCreator {
        require(marketId < markets.length, "Invalid");
        require(markets[marketId].status == MarketStatus.Creating, "Bad status");
        require(!registry.isDuplicate(question), "Duplicate");

        Market storage market = markets[marketId];
        market.question = question;
        market.odds = _bound(odds, 1, 99);
        market.deadline = _boundDeadline(deadline);
        market.sourceUrl = sourceUrl;
        market.selector = selector;
        market.data = data;

        address marketAddr = _marketAddress(marketId);
        try registry.registerMarket(marketAddr, market.question, market.odds, market.deadline, market.category, 1, false) {
            market.status = MarketStatus.Active;
            performance.totalCreated++;
            emit AutoRegistered(marketId, address(registry));
            emit MarketActive(marketId, market.question, market.odds, market.deadline);
        } catch {
            _fail(marketId, "registry_failed");
        }
    }

    function rejectCreated(uint256 marketId, string calldata reason) external onlyCreator {
        performance.totalRejected++;
        _fail(marketId, reason);
    }

    function resolveMarket(uint256 marketId) external onlyAuthorized {
        _startResolution(marketId);
    }

    function autoResolveExpired(uint256 marketId) external onlyAuthorized {
        _startResolution(marketId);
    }

    function _startResolution(uint256 marketId) internal {
        require(resolverModule != address(0), "Resolver unset");
        require(marketId < markets.length, "Invalid");
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Active, "Not active");
        require(block.timestamp >= market.deadline, "Not expired");
        market.status = MarketStatus.Resolving;
        emit MarketResolving(marketId);
        ISantioraV3Resolver(resolverModule).startResolve(marketId, market.question, market.category, market.sourceUrl, market.selector);
    }

    function finalizeResolved(uint256 marketId, string calldata outcome, uint256 confidence, string calldata data) external onlyResolver {
        require(marketId < markets.length, "Invalid");
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Resolving, "Bad status");
        uint256 boundedConfidence = _bound(confidence, 60, 100);
        market.outcome = _isYes(outcome) ? "YES" : "NO";
        market.confidence = boundedConfidence;
        market.data = data;
        market.status = MarketStatus.Resolved;

        performance.totalResolved++;
        performance.totalConfidenceSum += boundedConfidence;
        categorySuccessCount[market.category]++;

        try registry.updateMarket(_marketAddress(marketId), 3, market.outcome, boundedConfidence) {} catch {}
        emit MarketResolved(marketId, market.outcome, boundedConfidence);
    }

    function rejectResolution(uint256 marketId, string calldata reason) external onlyResolver {
        require(marketId < markets.length, "Invalid");
        markets[marketId].status = MarketStatus.Active;
        emit PipelineFailed(marketId, reason);
    }

    function failMarket(uint256 marketId, string calldata reason) external onlyOwner {
        _fail(marketId, reason);
    }

    function _fail(uint256 marketId, string memory reason) internal {
        if (marketId < markets.length) {
            markets[marketId].status = MarketStatus.Failed;
            performance.totalFailed++;
            categoryFailCount[markets[marketId].category]++;
        }
        emit PipelineFailed(marketId, reason);
    }

    function _canCreate(string calldata category) internal view returns (bool, string memory) {
        if (block.timestamp < rulesState.lastScanTimestamp + rules.scanInterval) return (false, "interval");
        uint256 today = block.timestamp >= rulesState.dayStartTimestamp + 1 days ? 0 : rulesState.marketsCreatedToday;
        if (today >= rules.maxMarketsPerDay) return (false, "daily_limit");
        if (!registry.hasTopicCapacity(category)) return (false, "topic_limit");
        return (true, "ready");
    }

    function _source(string memory category) internal pure returns (string memory, string memory) {
        if (_same(category, "crypto")) return ("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd&include_24hr_change=true", "bitcoin.usd");
        if (_same(category, "technology") || _same(category, "tech")) return ("https://api.github.com/search/repositories?q=created:>2026-05-25&sort=stars&order=desc&per_page=3", "items[0].full_name");
        if (_same(category, "finance")) return ("https://open.er-api.com/v6/latest/USD", "rates.EUR");
        return ("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328", "events[0].strEvent");
    }

    function _boundDeadline(uint256 deadline) internal view returns (uint256) {
        uint256 minDeadline = block.timestamp + rules.minMarketDuration;
        uint256 maxDeadline = block.timestamp + rules.maxMarketDuration;
        return _bound(deadline == 0 ? minDeadline : deadline, minDeadline, maxDeadline);
    }

    function _bound(uint256 value, uint256 minValue, uint256 maxValue) internal pure returns (uint256) {
        if (value < minValue) return minValue;
        if (value > maxValue) return maxValue;
        return value;
    }

    function _resetDayIfNeeded() internal {
        if (block.timestamp >= rulesState.dayStartTimestamp + 1 days) {
            rulesState.dayStartTimestamp = block.timestamp;
            rulesState.marketsCreatedToday = 0;
        }
    }

    function _marketAddress(uint256 marketId) internal view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(address(this), marketId)))));
    }

    function _isYes(string memory value) internal pure returns (bool) {
        return _same(value, "YES") || _same(value, "yes");
    }

    function _same(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    function getNextCategory() external view returns (string memory) {
        return categories[performance.totalCreated % categories.length];
    }

    function canCreateMarket(string calldata category) external view returns (bool allowed, string memory reason) {
        return _canCreate(category);
    }

    function getMarket(uint256 id) external view returns (string memory question, uint256 odds, uint256 deadline, string memory category, uint8 status, string memory outcome, uint256 confidence, string memory data) {
        Market storage market = markets[id];
        return (market.question, market.odds, market.deadline, market.category, uint8(market.status), market.outcome, market.confidence, market.data);
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getStats() external view returns (uint256 total, uint256 created, uint256 resolved, uint256 failed, uint256 avgConfidence) {
        uint256 avg = performance.totalResolved == 0 ? 0 : performance.totalConfidenceSum / performance.totalResolved;
        return (markets.length, performance.totalCreated, performance.totalResolved, performance.totalFailed, avg);
    }

    function getRulesState() external view returns (uint256 lastScan, uint256 todayCount, uint256 dayStart, uint256 balance) {
        return (rulesState.lastScanTimestamp, rulesState.marketsCreatedToday, rulesState.dayStartTimestamp, address(this).balance);
    }
}
