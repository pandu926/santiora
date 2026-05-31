// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title MarketRegistry — Single source of truth for all prediction markets
/// @notice Any contract or owner can register markets. Frontend reads only from here.
/// @dev Fully on-chain, no hardcoding needed in frontend
contract MarketRegistry {
    address public owner;

    struct MarketInfo {
        address marketAddress;
        string question;
        uint256 odds;
        uint256 deadline;
        string category;
        uint8 status; // 0=Creating, 1=Active, 2=Resolving, 3=Resolved
        string outcome;
        uint256 confidence;
        bool isSUSD; // true = PredictionMarketSUSD contract (bettable with SUSD)
        uint256 registeredAt;
    }

    MarketInfo[] public markets;
    mapping(address => bool) public authorizedRegistrars;
    mapping(address => uint256) public marketIndex;
    mapping(address => bool) public isRegistered;

    event MarketRegistered(uint256 indexed marketId, address marketAddress, string question, string category);
    event MarketUpdated(uint256 indexed marketId, uint8 status, string outcome, uint256 confidence);
    event RegistrarAdded(address registrar);
    event RegistrarRemoved(address registrar);

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

    /// @notice Register a new market
    function registerMarket(
        address marketAddress,
        string calldata question,
        uint256 odds,
        uint256 deadline,
        string calldata category,
        uint8 status,
        bool isSUSD
    ) external onlyOwnerOrRegistrar returns (uint256 marketId) {
        require(!isRegistered[marketAddress], "Already registered");

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
            registeredAt: block.timestamp
        }));

        marketIndex[marketAddress] = marketId;
        isRegistered[marketAddress] = true;

        emit MarketRegistered(marketId, marketAddress, question, category);
    }

    /// @notice Update market status (for resolution)
    function updateMarket(
        address marketAddress,
        uint8 status,
        string calldata outcome,
        uint256 confidence
    ) external onlyOwnerOrRegistrar {
        require(isRegistered[marketAddress], "Not registered");
        uint256 idx = marketIndex[marketAddress];
        markets[idx].status = status;
        markets[idx].outcome = outcome;
        markets[idx].confidence = confidence;
        emit MarketUpdated(idx, status, outcome, confidence);
    }

    /// @notice Add authorized registrar (e.g. SantioraFinal contract)
    function addRegistrar(address registrar) external onlyOwner {
        authorizedRegistrars[registrar] = true;
        emit RegistrarAdded(registrar);
    }

    /// @notice Remove registrar
    function removeRegistrar(address registrar) external onlyOwner {
        authorizedRegistrars[registrar] = false;
        emit RegistrarRemoved(registrar);
    }

    /// @notice Get market by index
    function getMarket(uint256 id) external view returns (
        address marketAddress, string memory question, uint256 odds, uint256 deadline,
        string memory category, uint8 status, string memory outcome, uint256 confidence, bool isSUSD
    ) {
        MarketInfo storage m = markets[id];
        return (m.marketAddress, m.question, m.odds, m.deadline, m.category, m.status, m.outcome, m.confidence, m.isSUSD);
    }

    /// @notice Total markets registered
    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    /// @notice Get all active markets count
    function getActiveCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 1) count++;
        }
    }

    /// @notice Get all resolved markets count
    function getResolvedCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < markets.length; i++) {
            if (markets[i].status == 3) count++;
        }
    }

    receive() external payable {}
}
