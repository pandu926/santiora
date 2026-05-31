// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title MarketFactoryLite
/// @notice Lightweight market factory — stores market metadata on-chain, no child contract deployment.
/// @dev Avoids Somnia gas issues with multi-contract creation in single TX.
contract MarketFactoryLite {
    struct Market {
        string question;
        uint256 deadline;
        bytes32 category;
        uint256 feePercent;
        uint256 createdAt;
        uint8 status; // 0=Created, 1=Active, 2=Resolving, 3=Resolved
        bool outcome;
        uint256 totalYes;
        uint256 totalNo;
    }

    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    Market[] public markets;
    mapping(address => bool) public authorizedAgents;
    mapping(bytes32 => uint256[]) public marketsByCategory;
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    mapping(uint256 => mapping(address => uint256)) public noBets;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 deadline,
        bytes32 indexed category,
        uint256 feePercent,
        uint256 timestamp
    );
    event BetPlaced(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event AgentAuthorized(address indexed agent);

    modifier onlyAuthorized() {
        require(msg.sender == PLATFORM_ADDRESS || authorizedAgents[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        authorizedAgents[msg.sender] = true;
    }

    receive() external payable {}

    function authorizeAgent(address agent) external onlyAuthorized {
        authorizedAgents[agent] = true;
        emit AgentAuthorized(agent);
    }

    function createMarket(
        string calldata question,
        uint256 deadline,
        string[] calldata,
        bytes32 category,
        uint256 feePercent
    ) external onlyAuthorized returns (address) {
        require(deadline > block.timestamp, "Deadline must be future");
        require(bytes(question).length > 0, "Empty question");
        require(feePercent <= 300, "Fee too high");

        uint256 marketId = markets.length;
        markets.push(Market({
            question: question,
            deadline: deadline,
            category: category,
            feePercent: feePercent,
            createdAt: block.timestamp,
            status: 1,
            outcome: false,
            totalYes: 0,
            totalNo: 0
        }));

        marketsByCategory[category].push(marketId);
        emit MarketCreated(marketId, question, deadline, category, feePercent, block.timestamp);

        // Return a deterministic "address" derived from marketId for compatibility
        return address(uint160(uint256(keccak256(abi.encodePacked(address(this), marketId)))));
    }

    function bet(uint256 marketId, bool isYes) external payable {
        require(marketId < markets.length, "Invalid market");
        Market storage m = markets[marketId];
        require(m.status == 1, "Market not active");
        require(block.timestamp < m.deadline, "Market expired");
        require(msg.value > 0, "Zero bet");

        if (isYes) {
            yesBets[marketId][msg.sender] += msg.value;
            m.totalYes += msg.value;
        } else {
            noBets[marketId][msg.sender] += msg.value;
            m.totalNo += msg.value;
        }

        emit BetPlaced(marketId, msg.sender, isYes, msg.value);
    }

    function resolveMarket(uint256 marketId, bool outcome) external onlyAuthorized {
        require(marketId < markets.length, "Invalid market");
        Market storage m = markets[marketId];
        require(m.status == 1, "Not active");
        require(block.timestamp >= m.deadline, "Not past deadline");

        m.status = 3;
        m.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.status == 3, "Not resolved");

        uint256 winAmount;
        if (m.outcome) {
            winAmount = yesBets[marketId][msg.sender];
            require(winAmount > 0, "No winning bet");
            yesBets[marketId][msg.sender] = 0;
            uint256 totalPool = m.totalYes + m.totalNo;
            uint256 payout = (winAmount * totalPool) / m.totalYes;
            uint256 fee = (payout * m.feePercent) / 10000;
            payable(msg.sender).transfer(payout - fee);
        } else {
            winAmount = noBets[marketId][msg.sender];
            require(winAmount > 0, "No winning bet");
            noBets[marketId][msg.sender] = 0;
            uint256 totalPool = m.totalYes + m.totalNo;
            uint256 payout = (winAmount * totalPool) / m.totalNo;
            uint256 fee = (payout * m.feePercent) / 10000;
            payable(msg.sender).transfer(payout - fee);
        }
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarket(uint256 marketId) external view returns (
        string memory question, uint256 deadline, bytes32 category,
        uint256 feePercent, uint256 createdAt, uint8 status,
        bool outcome, uint256 totalYes, uint256 totalNo
    ) {
        Market storage m = markets[marketId];
        return (m.question, m.deadline, m.category, m.feePercent, m.createdAt, m.status, m.outcome, m.totalYes, m.totalNo);
    }

    function getMarkets(uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 end = offset + limit;
        if (end > markets.length) end = markets.length;
        if (offset >= markets.length) return new uint256[](0);

        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = i;
        }
    }

    function getMarketsByCategory(bytes32 category) external view returns (uint256[] memory) {
        return marketsByCategory[category];
    }
}
