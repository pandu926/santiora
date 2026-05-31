// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";
import "../PredictionMarketSUSD.sol";

/// @title AgentSelfBetting
/// @notice AI Agent that bets on its own market predictions — skin in the game
/// @dev When AI creates a market and sets odds, it ALSO places a bet with treasury funds
///      on the side it believes is correct. Bad predictions cost the protocol.
contract AgentSelfBetting {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    struct AgentBet {
        address market;
        bool isYes;
        uint256 amount;
        uint256 confidence;
        bool settled;
        int256 pnl;
    }

    /// @notice All AI bets indexed by market address
    mapping(address => AgentBet[]) public agentBets;

    /// @notice Running profit/loss of AI betting (visible onchain)
    int256 public totalPnL;

    /// @notice Percentage of correct bets (basis points, e.g. 7500 = 75%)
    uint256 public winRate;

    /// @notice Total number of bets placed
    uint256 public betCount;

    /// @notice Total number of winning bets
    uint256 public winCount;

    event AgentBetPlaced(address indexed market, bool isYes, uint256 amount, uint256 confidence);
    event AgentBetSettled(address indexed market, bool won, int256 pnl);

    modifier onlyPlatform() {
        require(
            msg.sender == PLATFORM_ADDRESS,
            "Only Agent Platform"
        );
        _;
    }

    /// @notice Place a bet on a prediction market — only callable by platform (AI agent callback)
    /// @param market Address of the PredictionMarket contract
    /// @param isYes Whether to bet YES (true) or NO (false)
    /// @param amount Amount of STT to bet
    /// @param confidence AI confidence level (0-100)
    function placeBet(
        address market,
        bool isYes,
        uint256 amount,
        uint256 confidence
    ) external payable onlyPlatform {
        require(market != address(0), "Invalid market");
        require(amount > 0, "Zero amount");
        require(msg.value == amount, "Send exact STT");
        require(confidence > 0 && confidence <= 100, "Invalid confidence");

        // Place the bet on the prediction market
        PredictionMarketSUSD(payable(market)).bet{value: amount}(isYes, amount);

        // Record the bet
        agentBets[market].push(AgentBet({
            market: market,
            isYes: isYes,
            amount: amount,
            confidence: confidence,
            settled: false,
            pnl: 0
        }));

        betCount++;

        emit AgentBetPlaced(market, isYes, amount, confidence);
    }

    /// @notice Settle a bet after market resolution — anyone can call
    /// @param market Address of the resolved PredictionMarket
    function settleBet(address market) external {
        require(market != address(0), "Invalid market");

        AgentBet[] storage bets = agentBets[market];
        require(bets.length > 0, "No bets on market");

        PredictionMarketSUSD pm = PredictionMarketSUSD(payable(market));
        PredictionMarketSUSD.MarketStatus marketStatus = pm.status();
        require(
            marketStatus == PredictionMarketSUSD.MarketStatus.Resolved ||
            marketStatus == PredictionMarketSUSD.MarketStatus.Settled,
            "Market not resolved"
        );

        bool marketOutcome = pm.outcome();

        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].settled) continue;

            bets[i].settled = true;
            bool won = (bets[i].isYes == marketOutcome);

            if (won) {
                // Redeem winnings from the market
                uint256 balanceBefore = address(this).balance;
                pm.redeem();
                uint256 balanceAfter = address(this).balance;
                uint256 redeemed = balanceAfter - balanceBefore;

                int256 profit = int256(redeemed) - int256(bets[i].amount);
                bets[i].pnl = profit;
                totalPnL += profit;
                winCount++;

                emit AgentBetSettled(market, true, profit);
            } else {
                // Lost the bet — entire amount is gone
                int256 loss = -int256(bets[i].amount);
                bets[i].pnl = loss;
                totalPnL += loss;

                emit AgentBetSettled(market, false, loss);
            }
        }

        // Update win rate (basis points)
        if (betCount > 0) {
            winRate = (winCount * 10000) / betCount;
        }
    }

    /// @notice Get AI agent performance metrics
    /// @return totalBets Total number of bets placed
    /// @return wins Number of winning bets
    /// @return winRatePct Win rate in basis points (10000 = 100%)
    /// @return netPnL Net profit/loss in wei
    function getPerformance() external view returns (
        uint256 totalBets,
        uint256 wins,
        uint256 winRatePct,
        int256 netPnL
    ) {
        return (betCount, winCount, winRate, totalPnL);
    }

    /// @notice Get all agent bets for a specific market
    /// @param market Address of the PredictionMarket
    /// @return Array of AgentBet structs
    function getAgentBets(address market) external view returns (AgentBet[] memory) {
        return agentBets[market];
    }

    receive() external payable {}
}
