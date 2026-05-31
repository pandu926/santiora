// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ShareToken.sol";

/// @title PredictionMarketSUSD
/// @notice Single prediction market with binary outcome (YES/NO) using SUSD ERC20 for bets
/// @dev Uses ERC20 approve+transferFrom pattern instead of native STT
contract PredictionMarketSUSD {
    enum MarketStatus { Created, Active, Resolving, Resolved, Settled }

    IERC20 public immutable susd;
    address public immutable factory;
    mapping(address => bool) public authorizedAgents;
    ShareToken public immutable yesToken;
    ShareToken public immutable noToken;

    string public question;
    uint256 public deadline;
    string[] public resolutionSources;
    bytes32 public category;
    uint256 public createdAt;

    MarketStatus public status;
    bool public outcome; // true = YES won, false = NO won
    uint256 public resolutionConfidence;
    string public resolutionReasoning;

    uint256 public totalCollateral;
    uint256 public feePercent; // basis points (100 = 1%)

    event BetPlaced(address indexed user, bool isYes, uint256 amount, uint256 sharesReceived);
    event MarketResolved(bool outcome, uint256 confidence, string reasoning);
    event WinningsRedeemed(address indexed user, uint256 amount);
    event MarketActivated(uint256 timestamp);
    event StatusChanged(MarketStatus oldStatus, MarketStatus newStatus);
    event LiquidityAdded(address indexed provider, uint256 yesAmount, uint256 noAmount);

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier onlyPlatformOrAgent() {
        require(authorizedAgents[msg.sender], "Only authorized agent");
        _;
    }

    modifier onlyActive() {
        require(status == MarketStatus.Active, "Market not active");
        _;
    }

    constructor(
        string memory _question,
        uint256 _deadline,
        string[] memory _resolutionSources,
        bytes32 _category,
        uint256 _feePercent,
        address _factory,
        address _susd
    ) {
        require(_susd != address(0), "Invalid SUSD address");
        require(_factory != address(0), "Invalid factory address");

        question = _question;
        deadline = _deadline;
        resolutionSources = _resolutionSources;
        category = _category;
        feePercent = _feePercent;
        factory = _factory;
        susd = IERC20(_susd);
        createdAt = block.timestamp;
        status = MarketStatus.Created;
        authorizedAgents[_factory] = true;

        string memory yesName = string.concat("YES-", _question);
        string memory noName = string.concat("NO-", _question);
        yesToken = new ShareToken(yesName, "YES", address(this));
        noToken = new ShareToken(noName, "NO", address(this));
    }

    /// @notice Activate market (called by factory after liquidity seeded)
    function activate() external onlyFactory {
        require(status == MarketStatus.Created, "Already active");
        MarketStatus old = status;
        status = MarketStatus.Active;
        emit StatusChanged(old, status);
        emit MarketActivated(block.timestamp);
    }

    /// @notice Add initial liquidity — callable by factory or authorized agents
    /// @param yesAmount Amount of SUSD to allocate to YES side
    /// @param noAmount Amount of SUSD to allocate to NO side
    function addLiquidity(uint256 yesAmount, uint256 noAmount) external onlyFactory {
        require(yesAmount > 0 || noAmount > 0, "Zero liquidity");

        uint256 totalAmount = yesAmount + noAmount;
        // Transfer SUSD from sender (checks-effects-interactions: state first)
        totalCollateral += totalAmount;

        bool transferred = susd.transferFrom(msg.sender, address(this), totalAmount);
        require(transferred, "SUSD transfer failed");

        // Mint share tokens proportionally to this contract (held as liquidity)
        if (yesAmount > 0) {
            yesToken.mint(address(this), yesAmount);
        }
        if (noAmount > 0) {
            noToken.mint(address(this), noAmount);
        }

        emit LiquidityAdded(msg.sender, yesAmount, noAmount);
    }

    /// @notice Buy YES or NO shares using SUSD — PUBLIC (anyone can bet)
    /// @dev User must approve this contract for `amount` SUSD before calling
    /// @param isYes true to buy YES shares, false to buy NO shares
    /// @param amount Amount of SUSD to spend
    function bet(bool isYes, uint256 amount) external onlyActive {
        require(block.timestamp < deadline, "Market expired");
        require(amount > 0, "Zero amount");

        uint256 fee = (amount * feePercent) / 10000;
        uint256 netAmount = amount - fee;

        // Checks-effects-interactions: update state before external call
        totalCollateral += netAmount;

        // Transfer SUSD from user
        bool transferred = susd.transferFrom(msg.sender, address(this), amount);
        require(transferred, "SUSD transfer failed");

        // Mint shares 1:1 (AMM pricing via supply ratio)
        if (isYes) {
            yesToken.mint(msg.sender, netAmount);
        } else {
            noToken.mint(msg.sender, netAmount);
        }

        emit BetPlaced(msg.sender, isYes, amount, netAmount);
    }

    /// @notice Resolve market — ONLY via authorized agent
    function resolve(bool _outcome, uint256 _confidence, string calldata _reasoning) external onlyPlatformOrAgent {
        require(status == MarketStatus.Active || status == MarketStatus.Resolving, "Cannot resolve");
        require(_confidence >= 80, "Confidence too low");

        MarketStatus old = status;
        outcome = _outcome;
        resolutionConfidence = _confidence;
        resolutionReasoning = _reasoning;
        status = MarketStatus.Resolved;

        emit StatusChanged(old, status);
        emit MarketResolved(_outcome, _confidence, _reasoning);
    }

    /// @notice Set status to Resolving (AI is working on it)
    function setResolving() external onlyPlatformOrAgent {
        require(status == MarketStatus.Active, "Not active");
        MarketStatus old = status;
        status = MarketStatus.Resolving;
        emit StatusChanged(old, status);
    }

    /// @notice Redeem winning shares for SUSD — PUBLIC
    function redeem() external {
        require(status == MarketStatus.Resolved || status == MarketStatus.Settled, "Not resolved");

        uint256 winnings;
        if (outcome) {
            uint256 shares = yesToken.balanceOf(msg.sender);
            require(shares > 0, "No winning shares");
            // Burn shares before transfer (CEI pattern - T-08-03 mitigation)
            yesToken.burn(msg.sender, shares);
            winnings = shares;
        } else {
            uint256 shares = noToken.balanceOf(msg.sender);
            require(shares > 0, "No winning shares");
            // Burn shares before transfer (CEI pattern - T-08-03 mitigation)
            noToken.burn(msg.sender, shares);
            winnings = shares;
        }

        if (status == MarketStatus.Resolved) {
            status = MarketStatus.Settled;
        }

        // Transfer SUSD to winner
        bool sent = susd.transfer(msg.sender, winnings);
        require(sent, "SUSD transfer failed");

        emit WinningsRedeemed(msg.sender, winnings);
    }

    /// @notice Update fee — ONLY via authorized agent
    function setFee(uint256 _feePercent) external onlyPlatformOrAgent {
        require(_feePercent <= 300, "Fee too high"); // max 3%
        feePercent = _feePercent;
    }

    function getResolutionSources() external view returns (string[] memory) {
        return resolutionSources;
    }

    function authorizeAgent(address agent) external onlyFactory {
        authorizedAgents[agent] = true;
    }

    function getMarketInfo() external view returns (
        string memory _question,
        uint256 _deadline,
        bytes32 _category,
        MarketStatus _status,
        uint256 _totalCollateral,
        uint256 _yesSupply,
        uint256 _noSupply
    ) {
        return (question, deadline, category, status, totalCollateral, yesToken.totalSupply(), noToken.totalSupply());
    }

    /// @notice Get current odds based on token supply ratio
    /// @return yesOdds Percentage (0-100) representing YES probability
    /// @return noOdds Percentage (0-100) representing NO probability
    function getOdds() external view returns (uint256 yesOdds, uint256 noOdds) {
        uint256 yesSupply = yesToken.totalSupply();
        uint256 noSupply = noToken.totalSupply();
        uint256 total = yesSupply + noSupply;

        if (total == 0) {
            return (50, 50);
        }

        // Odds inversely proportional to supply (more shares = lower price)
        // YES odds = NO supply / total (more NO shares means YES is more likely)
        yesOdds = (noSupply * 100) / total;
        noOdds = (yesSupply * 100) / total;
    }
}
