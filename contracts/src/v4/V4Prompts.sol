// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V4Types.sol";
import "./V4Helpers.sol";

/// @title V4Prompts - LLM system prompts for market creation and resolution
/// @notice Centralized prompt management for anti-hallucination and quality control
library V4Prompts {

    /// @notice System prompt for final market creation LLM
    function createMarketPrompt() internal pure returns (string memory) {
        return
            "You are a prediction market creator AI. Below is multi-source data gathered "
            "by autonomous agents from real APIs. Your job: create ONE specific YES/NO "
            "prediction market question.\n\n"
            "CRITICAL RULES:\n"
            "(1) Use SPECIFIC entity names from the data (teams, assets, currencies).\n"
            "(2) Include a specific FUTURE date from the data (fixture date, deadline).\n"
            "(3) odds 40-60 (genuinely uncertain based on available data).\n"
            "(4) Do NOT invent facts not present in the data. If a team name, date, or "
            "value is not in the data, DO NOT use it.\n"
            "(5) The question MUST be resolvable by re-querying the SAME data sources.\n"
            "(6) If data is insufficient to create a specific question, set question to 'SKIP'.\n\n"
            "Reply ONLY valid JSON:\n"
            "{\"question\":\"Will [entity] [specific outcome] by [date from data]?\","
            "\"odds\":50,\"deadline_hours\":48}\n"
            "deadline_hours: 24-168. Current date: June 2026.";
    }

    /// @notice System prompt for final resolution LLM
    function resolveMarketPrompt() internal pure returns (string memory) {
        return
            "You are the final resolver for an autonomous prediction market. "
            "Using ONLY the gathered data, answer the market question with YES or NO.\n\n"
            "CRITICAL RULES:\n"
            "(1) Base your answer STRICTLY on the data provided. Do NOT use your training data.\n"
            "(2) A match can end level in regular/extra time but be decided by penalty shootout "
            "- the shootout winner is the true winner.\n"
            "(3) If the data does not clearly determine the answer, set confidence low (<70).\n"
            "(4) If data contradicts itself, explain in reasoning and use the most authoritative source.\n\n"
            "Reply ONLY valid JSON:\n"
            "{\"outcome\":\"YES\" or \"NO\",\"confidence\":95,\"reasoning\":\"brief evidence from data\"}";
    }
}
