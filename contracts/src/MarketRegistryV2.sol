// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title MarketRegistryV2 — Dedup-aware registry with question hash checking
/// @notice Extends V1 with question-based dedup, existing questions view for LLM context,
///         and topic-based diversity tracking. Backward-compatible interface.
contract MarketRegistryV2 {
    address public owner;

    struct MarketInfo {
        address marketAddress;
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        uint8 status; // 0=Creating, 1=Active, 2=Resolving, 3=Resolved, 4=Failed
        string outcome;
        uint256 confidence;
        bool isSUSD;
        uint256 registeredAt;
        bytes32 questionHash;
    }

    MarketInfo[] public markets;
    mapping(address => bool) public authorizedRegistrars;
    mapping(address => uint256) public marketIndex;
    mapping(address => bool) public isRegistered;

    // ═══════════════════════════════════════════════════════════════
    // V2: Question dedup
    // ═══════════════════════════════════════════════════════════════

    mapping(bytes32 => bool) public questionHashExists;
    mapping(bytes32 => uint256) public questionHashToMarketId;

    // ═══════════════════════════════════════════════════════════════
    // V2: Topic diversity tracking
    // ═══════════════════════════════════════════════════════════════

    mapping(bytes32 => uint256) public activeCountByTopic;
    uint256 public constant MAX_ACTIVE_PER_TOPIC = 3;

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════

    event MarketRegistered(uint256 indexed marketId, address marketAddress, string question, string category);
    event MarketUpdated(uint256 indexed marketId, uint8 status, string outcome, uint256 confidence);
    event RegistrarAdded(address registrar);
    event RegistrarRemoved(address registrar);
    event DuplicateRejected(bytes32 questionHash, string question);
    event TopicLimitReached(bytes32 topicHash, string category);

    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyOwnerOrRegistrar() {
        require(msg.sender == owner || authorizedRegistrars[msg.sender], "Not authorized");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ═══════════════════════════════════════════════════════════════
    // REGISTER (V2 — with dedup + diversity)
    // ═══════════════════════════════════════════════════════════════

    /// @notice Register a new market with question dedup check
    function registerMarket(
        address marketAddress,
        string calldata question,
        uint256 odds,
        uint256 deadline,
        string calldata category,
        uint8 status,
        bool isSUSD
    ) external onlyOwnerOrRegistrar returns (uint256 marketId) {
        require(!isRegistered[marketAddress], "Address already registered");

        bytes32 qHash = _normalizeHash(question);
        require(!questionHashExists[qHash], "Duplicate question");

        marketId = markets.length;
        markets.push(MarketInfo({
            marketAddress: marketAddress,
            question: question,
            odds: odds,
            deadline: deadline,
            category: category,
            status: status,
            outcome: "",
            confidence: 0,
            isSUSD: isSUSD,
            registeredAt: block.timestamp,
            questionHash: qHash
        }));

        marketIndex[marketAddress] = marketId;
        isRegistered[marketAddress] = true;
        questionHashExists[qHash] = true;
        questionHashToMarketId[qHash] = marketId;

        // Track topic diversity
        bytes32 topicHash = keccak256(abi.encodePacked(category));
        if (status == 1) {
            activeCountByTopic[topicHash]++;
        }

        emit MarketRegistered(marketId, marketAddress, question, category);
    }

    /// @notice Check if a question would be a duplicate before registering
    function isDuplicate(string calldata question) external view returns (bool) {
        return questionHashExists[_normalizeHash(question)];
    }

    /// @notice Check if topic has room for more active markets
    function hasTopicCapacity(string calldata category) external view returns (bool) {
        bytes32 topicHash = keccak256(abi.encodePacked(category));
        return activeCountByTopic[topicHash] < MAX_ACTIVE_PER_TOPIC;
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice Update market status (for resolution)
    function updateMarket(
        address marketAddress,
        uint8 status,
        string calldata outcome,
        uint256 confidence
    ) external onlyOwnerOrRegistrar {
        require(isRegistered[marketAddress], "Not registered");
        uint256 idx = marketIndex[marketAddress];
        MarketInfo storage m = markets[idx];

        uint8 oldStatus = m.status;
        m.status = status;
        m.outcome = outcome;
        m.confidence = confidence;

        // Update topic diversity: if going from active to resolved/failed
        if (oldStatus == 1 && (status == 3 || status == 4)) {
            bytes32 topicHash = keccak256(abi.encodePacked(m.category));
            if (activeCountByTopic[topicHash] > 0) {
                activeCountByTopic[topicHash]--;
            }
        }

        emit MarketUpdated(idx, status, outcome, confidence);
    }

    // ═══════════════════════════════════════════════════════════════
    // LLM CONTEXT — Existing questions for dedup prompt
    // ═══════════════════════════════════════════════════════════════

    /// @notice Get recent questions for LLM context (to prevent duplicates)
    /// @param count Number of recent questions to return (max 20)
    /// @return questions Array of recent market questions
    function getRecentQuestions(uint256 count) external view returns (string[] memory questions) {
        uint256 total = markets.length;
        if (count > 20) count = 20;
        if (count > total) count = total;

        questions = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            questions[i] = markets[total - count + i].question;
        }
    }

    /// @notice Get questions with pagination for larger context
    function getQuestions(uint256 offset, uint256 limit) external view returns (string[] memory questions) {
        uint256 total = markets.length;
        if (offset >= total) return new string[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 size = end - offset;

        questions = new string[](size);
        for (uint256 i = 0; i < size; i++) {
            questions[i] = markets[offset + i].question;
        }
    }

    /// @notice Get active markets by category
    function getActiveByCategory(string calldata category) external view returns (uint256[] memory ids) {
        uint256 count = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1 && _strEq(markets[i].category, category)) {
                count++;
            }
        }

        ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1 && _strEq(markets[i].category, category)) {
                ids[idx++] = i;
            }
        }
    }

    /// @notice Get all expired active markets (for resolution scanning)
    function getExpiredMarkets() external view returns (uint256[] memory ids) {
        uint256 count = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1 && block.timestamp >= markets[i].deadline) {
                count++;
            }
        }

        ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1 && block.timestamp >= markets[i].deadline) {
                ids[idx++] = i;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════

    function addRegistrar(address registrar) external onlyOwner {
        authorizedRegistrars[registrar] = true;
        emit RegistrarAdded(registrar);
    }

    function removeRegistrar(address registrar) external onlyOwner {
        authorizedRegistrars[registrar] = false;
        emit RegistrarRemoved(registrar);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW — Backward compatible with V1
    // ═══════════════════════════════════════════════════════════════

    function getMarket(uint256 id) external view returns (
        address marketAddress, string memory question, uint256 odds, uint256 deadline,
        string memory category, uint8 status, string memory outcome, uint256 confidence, bool isSUSD
    ) {
        MarketInfo storage m = markets[id];
        return (m.marketAddress, m.question, m.odds, m.deadline, m.category, m.status, m.outcome, m.confidence, m.isSUSD);
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getActiveCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1) count++;
        }
    }

    function getResolvedCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 3) count++;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════

    /// @notice Normalize question to lowercase first-60-chars hash for dedup
    /// @dev Matches frontend dedup logic — first 60 chars, case-insensitive
    function _normalizeHash(string memory question) internal pure returns (bytes32) {
        bytes memory b = bytes(question);
        uint256 len = b.length > 60 ? 60 : b.length;
        bytes memory normalized = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            if (c >= 0x41 && c <= 0x5A) {
                normalized[i] = bytes1(uint8(c) + 32); // to lowercase
            } else {
                normalized[i] = c;
            }
        }
        return keccak256(normalized);
    }

    function _strEq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    receive() external payable {}
}
