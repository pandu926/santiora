// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";
import "../PredictionMarketSUSD.sol";
import "../ShareToken.sol";

/// @title LiquidityEngine
/// @notice AI-managed AMM for prediction markets — constant product formula with dynamic fees
/// @dev AI seeds liquidity, adjusts parameters, manages treasury allocation
contract LiquidityEngine {
    IAgentRequester public constant PLATFORM = IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 public constant LLM_PER_AGENT_COST = 0.07 ether;
    uint256 public constant JSON_API_PER_AGENT_COST = 0.03 ether;
    uint256 public constant SUBCOMMITTEE_SIZE = 3;

    struct Pool {
        address market;
        uint256 yesReserve;
        uint256 noReserve;
        uint256 k; // constant product
        uint256 feePercent; // basis points (100 = 1%)
        uint256 totalVolume;
        uint256 totalFees;
        bool active;
    }

    mapping(address => Pool) public pools;
    address[] public activeMarkets;
    uint256 public totalPools;
    uint256 public totalVolumeAllPools;

    event PoolCreated(address indexed market, uint256 yesReserve, uint256 noReserve, uint256 fee);
    event Swap(address indexed market, address indexed user, bool buyYes, uint256 amountIn, uint256 amountOut, uint256 fee);
    event OddsUpdated(address indexed market, uint256 yesOdds, uint256 noOdds);
    event FeeAdjusted(address indexed market, uint256 oldFee, uint256 newFee);
    event LiquidityAdded(address indexed market, uint256 yesAmount, uint256 noAmount);

    modifier onlyPlatformOrAuthorized() {
        require(msg.sender == PLATFORM_ADDRESS || msg.sender == address(this), "Not authorized");
        _;
    }

    constructor() {}

    receive() external payable {}

    // =========================================================================
    // Pool Management
    // =========================================================================

    /// @notice Create AMM pool for a market with initial 50/50 odds
    function createPool(address market, uint256 initialLiquidity, uint256 feePercent) external returns (bool) {
        require(!pools[market].active, "Pool exists");
        require(initialLiquidity > 0, "Zero liquidity");
        require(feePercent >= 50 && feePercent <= 300, "Fee 0.5-3%");

        // 50/50 split = equal odds
        uint256 halfLiquidity = initialLiquidity / 2;

        pools[market] = Pool({
            market: market,
            yesReserve: halfLiquidity,
            noReserve: halfLiquidity,
            k: halfLiquidity * halfLiquidity,
            feePercent: feePercent,
            totalVolume: 0,
            totalFees: 0,
            active: true
        });

        activeMarkets.push(market);
        totalPools++;

        emit PoolCreated(market, halfLiquidity, halfLiquidity, feePercent);
        return true;
    }

    /// @notice Create pool with custom initial odds (e.g., 70% YES / 30% NO)
    function createPoolWithOdds(address market, uint256 initialLiquidity, uint256 yesPercent, uint256 feePercent) external returns (bool) {
        require(!pools[market].active, "Pool exists");
        require(initialLiquidity > 0, "Zero liquidity");
        require(yesPercent > 0 && yesPercent < 100, "Invalid odds");
        require(feePercent >= 50 && feePercent <= 300, "Fee 0.5-3%");

        // Odds determine reserve ratio (higher odds = less YES reserve = more expensive to buy YES)
        uint256 noReserve = (initialLiquidity * yesPercent) / 100;
        uint256 yesReserve = (initialLiquidity * (100 - yesPercent)) / 100;

        pools[market] = Pool({
            market: market,
            yesReserve: yesReserve,
            noReserve: noReserve,
            k: yesReserve * noReserve,
            feePercent: feePercent,
            totalVolume: 0,
            totalFees: 0,
            active: true
        });

        activeMarkets.push(market);
        totalPools++;

        emit PoolCreated(market, yesReserve, noReserve, feePercent);
        return true;
    }

    // =========================================================================
    // Trading (PUBLIC — anyone can swap)
    // =========================================================================

    /// @notice Buy YES or NO shares from the AMM pool
    function swap(address market, bool buyYes, uint256 amountIn) external payable returns (uint256 amountOut) {
        require(msg.value == amountIn, "Send exact STT");
        Pool storage pool = pools[market];
        require(pool.active, "Pool not active");
        require(amountIn > 0, "Zero amount");

        uint256 fee = (amountIn * pool.feePercent) / 10000;
        uint256 netIn = amountIn - fee;

        if (buyYes) {
            // Buy YES: add to noReserve, remove from yesReserve
            uint256 newNoReserve = pool.noReserve + netIn;
            uint256 newYesReserve = pool.k / newNoReserve;
            amountOut = pool.yesReserve - newYesReserve;
            pool.yesReserve = newYesReserve;
            pool.noReserve = newNoReserve;
        } else {
            // Buy NO: add to yesReserve, remove from noReserve
            uint256 newYesReserve = pool.yesReserve + netIn;
            uint256 newNoReserve = pool.k / newYesReserve;
            amountOut = pool.noReserve - newNoReserve;
            pool.noReserve = newNoReserve;
            pool.yesReserve = newYesReserve;
        }

        require(amountOut > 0, "Insufficient output");

        pool.totalVolume += amountIn;
        pool.totalFees += fee;
        totalVolumeAllPools += amountIn;

        emit Swap(market, msg.sender, buyYes, amountIn, amountOut, fee);

        // Emit updated odds
        uint256 total = pool.yesReserve + pool.noReserve;
        uint256 yesOdds = (pool.noReserve * 100) / total;
        emit OddsUpdated(market, yesOdds, 100 - yesOdds);

        return amountOut;
    }

    // =========================================================================
    // AI-Managed Fee Adjustment
    // =========================================================================

    /// @notice AI adjusts fee based on market volatility — called via Agent Platform
    function adjustFee(address market, uint256 newFeePercent) external onlyPlatformOrAuthorized {
        Pool storage pool = pools[market];
        require(pool.active, "Pool not active");
        require(newFeePercent >= 50 && newFeePercent <= 300, "Fee 0.5-3%");

        uint256 oldFee = pool.feePercent;
        pool.feePercent = newFeePercent;

        emit FeeAdjusted(market, oldFee, newFeePercent);
    }

    /// @notice Request AI to analyze and adjust fee for a market
    function requestFeeAdjustment(address market) external returns (uint256 requestId) {
        Pool storage pool = pools[market];
        require(pool.active, "Pool not active");

        string memory prompt = string.concat(
            "A prediction market AMM pool has:\n",
            "- Total volume: ", _uint2str(pool.totalVolume / 1e18), " STT\n",
            "- Current fee: ", _uint2str(pool.feePercent), " basis points\n",
            "- YES reserve: ", _uint2str(pool.yesReserve / 1e18), "\n",
            "- NO reserve: ", _uint2str(pool.noReserve / 1e18), "\n\n",
            "What should the fee be (50-300 basis points)? Higher fee for volatile/low-liquidity markets, lower for stable/high-volume."
        );

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            prompt,
            "You are a DeFi liquidity manager. Set optimal AMM fees.",
            int256(50),
            int256(300),
            false
        );

        uint256 deposit = _getLLMDeposit();
        requestId = PLATFORM.createRequest{value: deposit}(
            LLM_AGENT_ID,
            address(this),
            this.handleFeeAdjustment.selector,
            payload
        );
    }

    function handleFeeAdjustment(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatformOrAuthorized {
        if (status == ResponseStatus.Success && responses.length > 0) {
            int256 newFee = abi.decode(responses[0].result, (int256));
            // Apply to most recent active market (simplified — production would track requestId → market)
            if (activeMarkets.length > 0) {
                address lastMarket = activeMarkets[activeMarkets.length - 1];
                Pool storage pool = pools[lastMarket];
                if (pool.active) {
                    uint256 oldFee = pool.feePercent;
                    pool.feePercent = uint256(newFee);
                    emit FeeAdjusted(lastMarket, oldFee, uint256(newFee));
                }
            }
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get current odds for a market (percentage)
    function getOdds(address market) external view returns (uint256 yesPercent, uint256 noPercent) {
        Pool storage pool = pools[market];
        if (!pool.active) return (50, 50);
        uint256 total = pool.yesReserve + pool.noReserve;
        if (total == 0) return (50, 50);
        yesPercent = (pool.noReserve * 100) / total;
        noPercent = 100 - yesPercent;
    }

    /// @notice Get price to buy a specific amount of YES/NO shares
    function getQuote(address market, bool buyYes, uint256 amountIn) external view returns (uint256 amountOut, uint256 fee) {
        Pool storage pool = pools[market];
        require(pool.active, "Pool not active");

        fee = (amountIn * pool.feePercent) / 10000;
        uint256 netIn = amountIn - fee;

        if (buyYes) {
            uint256 newNoReserve = pool.noReserve + netIn;
            uint256 newYesReserve = pool.k / newNoReserve;
            amountOut = pool.yesReserve - newYesReserve;
        } else {
            uint256 newYesReserve = pool.yesReserve + netIn;
            uint256 newNoReserve = pool.k / newYesReserve;
            amountOut = pool.noReserve - newNoReserve;
        }
    }

    /// @notice Get pool stats
    function getPoolStats(address market) external view returns (
        uint256 yesReserve, uint256 noReserve, uint256 feePercent,
        uint256 totalVolume, uint256 totalFees, bool active
    ) {
        Pool storage p = pools[market];
        return (p.yesReserve, p.noReserve, p.feePercent, p.totalVolume, p.totalFees, p.active);
    }

    function getActiveMarketCount() external view returns (uint256) {
        return activeMarkets.length;
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _getLLMDeposit() internal view returns (uint256) {
        return PLATFORM.getRequestDeposit() + (LLM_PER_AGENT_COST * SUBCOMMITTEE_SIZE);
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
