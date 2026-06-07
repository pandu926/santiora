// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISantioraV5 {
    function markets(uint256 index) external view returns (
        string memory question,
        uint256 odds,
        uint256 deadline,
        string memory category,
        uint8 status,
        string memory outcome,
        uint256 confidence,
        uint256 createdAt,
        string memory sourceUrl,
        string memory rawResponse
    );
    function marketCount() external view returns (uint256);
}

/// @title V5BettingPool
/// @notice Parimutuel betting pool for SantioraV5 prediction markets.
///         Single contract handles all V5 market IDs. SUSD-based.
///         Odds shift per bet (YES pool / NO pool ratio).
///         Fee 1.5% taken at bet time. Owner can withdraw accumulated fees.
contract V5BettingPool {
    IERC20 public immutable susd;
    ISantioraV5 public immutable v5;
    address public owner;

    uint256 public constant FEE_BPS = 150;    // 1.5%
    uint256 public constant BPS_BASE = 10_000;
    uint256 public constant MIN_BET = 1 ether; // 1 SUSD

    // V5 market status codes
    uint8 public constant STATUS_ACTIVE    = 1;
    uint8 public constant STATUS_RESOLVING = 2;
    uint8 public constant STATUS_RESOLVED  = 3;

    struct Pool {
        uint256 yesTotal;  // total SUSD net in YES side
        uint256 noTotal;   // total SUSD net in NO side
        bool    exists;
    }

    // marketId → Pool totals
    mapping(uint256 => Pool) public pools;

    // marketId → user → net SUSD placed on YES/NO
    mapping(uint256 => mapping(address => uint256)) public yesShares;
    mapping(uint256 => mapping(address => uint256)) public noShares;

    // marketId → user → already claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    // accumulated protocol fees
    uint256 public feesAccrued;

    // reentrancy guard
    bool private _locked;

    event BetPlaced(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 netShares);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed prev, address indexed next);

    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _susd, address _v5) {
        require(_susd != address(0) && _v5 != address(0), "zero address");
        susd  = IERC20(_susd);
        v5    = ISantioraV5(_v5);
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────
    // BETTING
    // ─────────────────────────────────────────────────────────────

    /// @notice Bet SUSD on a V5 market.
    /// @param marketId  V5 market index (0-based)
    /// @param isYes     true = bet YES, false = bet NO
    /// @param amount    SUSD to spend (must be approved by caller)
    function bet(uint256 marketId, bool isYes, uint256 amount) external nonReentrant {
        require(amount >= MIN_BET, "below min");

        (, , uint256 deadline, , uint8 status, , , , , ) = v5.markets(marketId);

        require(status == STATUS_ACTIVE || status == STATUS_RESOLVING, "market not bettable");
        require(block.timestamp < deadline, "past deadline");

        uint256 fee     = (amount * FEE_BPS) / BPS_BASE;
        uint256 netAmt  = amount - fee;

        // CEI: state before transfer
        if (!pools[marketId].exists) {
            pools[marketId].exists = true;
        }

        feesAccrued += fee;

        if (isYes) {
            pools[marketId].yesTotal       += netAmt;
            yesShares[marketId][msg.sender] += netAmt;
        } else {
            pools[marketId].noTotal        += netAmt;
            noShares[marketId][msg.sender]  += netAmt;
        }

        // Transfer full amount (fee + net) from user
        require(susd.transferFrom(msg.sender, address(this), amount), "transfer failed");

        emit BetPlaced(marketId, msg.sender, isYes, amount, netAmt);
    }

    // ─────────────────────────────────────────────────────────────
    // CLAIM
    // ─────────────────────────────────────────────────────────────

    /// @notice Claim winnings after market resolves. Winners split total pool
    ///         proportionally. UNRESOLVABLE → refund your net bet.
    function claim(uint256 marketId) external nonReentrant {
        require(!claimed[marketId][msg.sender], "already claimed");

        (, , , , uint8 status, string memory outcome, , , , ) = v5.markets(marketId);

        require(status == STATUS_RESOLVED, "not resolved yet");

        uint256 payout = _calcPayout(marketId, msg.sender, outcome);
        require(payout > 0, "nothing to claim");

        // CEI: mark claimed before transfer
        claimed[marketId][msg.sender] = true;

        require(susd.transfer(msg.sender, payout), "transfer failed");

        emit Claimed(marketId, msg.sender, payout);
    }

    // ─────────────────────────────────────────────────────────────
    // VIEW
    // ─────────────────────────────────────────────────────────────

    /// @notice Current odds for a market (yes%, no%). Returns (50,50) if no bets.
    function getOdds(uint256 marketId) external view returns (uint256 yesOdds, uint256 noOdds) {
        Pool storage p = pools[marketId];
        uint256 total  = p.yesTotal + p.noTotal;
        if (total == 0) return (50, 50);
        yesOdds = (p.yesTotal * 100) / total;
        noOdds  = 100 - yesOdds;
    }

    /// @notice User position on a market.
    function getPosition(uint256 marketId, address user)
        external view
        returns (uint256 yes, uint256 no)
    {
        return (yesShares[marketId][user], noShares[marketId][user]);
    }

    /// @notice Preview payout for a user given current resolution state.
    function previewPayout(uint256 marketId, address user) external view returns (uint256) {
        (, , , , uint8 status, string memory outcome, , , , ) = v5.markets(marketId);
        if (status < STATUS_RESOLVED) return 0;
        if (claimed[marketId][user]) return 0;
        return _calcPayout(marketId, user, outcome);
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────

    function withdrawFees(address to) external onlyOwner {
        uint256 amt = feesAccrued;
        require(amt > 0, "no fees");
        feesAccrued = 0;
        require(susd.transfer(to, amt), "transfer failed");
        emit FeesWithdrawn(to, amt);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNAL
    // ─────────────────────────────────────────────────────────────

    function _calcPayout(uint256 marketId, address user, string memory outcome)
        internal view
        returns (uint256 payout)
    {
        Pool storage p = pools[marketId];
        uint256 total  = p.yesTotal + p.noTotal;
        if (total == 0) return 0;

        bool outcomeYes = _strEq(outcome, "YES");
        bool outcomeNo  = _strEq(outcome, "NO");

        if (outcomeYes) {
            uint256 userYes = yesShares[marketId][user];
            if (userYes == 0 || p.yesTotal == 0) return 0;
            payout = (total * userYes) / p.yesTotal;
        } else if (outcomeNo) {
            uint256 userNo = noShares[marketId][user];
            if (userNo == 0 || p.noTotal == 0) return 0;
            payout = (total * userNo) / p.noTotal;
        } else {
            // UNRESOLVABLE or unknown — refund net bet
            payout = yesShares[marketId][user] + noShares[marketId][user];
        }
    }

    function _strEq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
