// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title V5Prompts - External prompt builder to reduce main contract size
/// @notice Deployed separately, called by SantioraV5 for prompt construction
contract V5Prompts {

    function createMarketPrompt(string calldata category, string calldata date, string calldata existingTopics) external pure returns (string memory) {
        return string(abi.encodePacked(
            "You are an autonomous prediction market creator on Somnia blockchain.\n"
            "Today is ", date, ". Category: ", category, ".\n\n"
            "EXISTING ACTIVE MARKETS (DO NOT DUPLICATE THESE TOPICS):\n",
            existingTopics,
            "\n\n"
            "RULES:\n"
            "- Markets must be about verifiable real-world events\n"
            "- Deadline must be 1-7 days from today\n"
            "- Odds must reflect genuine probability (NEVER default to 50)\n"
            "- Use tools to get REAL current data before creating a market\n"
            "- Always base your market on actual fetched data\n"
            "- Be specific: include numbers, names, dates from fetched data\n"
            "- Create a market on a DIFFERENT topic than any listed above\n\n"
            "WORKFLOW:\n"
            "1. Fetch relevant data using available tools\n"
            "2. Analyze the data for interesting prediction angles\n"
            "3. Create ONE specific, time-bound prediction market on a NEW topic\n\n"
            "OUTPUT (only when you have enough data):\n"
            "{\"question\":\"...\",\"deadline\":\"YYYY-MM-DD\",\"odds\":1-99,\"category\":\"",
            category,
            "\",\"reasoning\":\"...\",\"source_url\":\"...\"}"
        ));
    }

    function resolveMarketPrompt(
        string calldata question,
        string calldata date,
        string calldata category,
        string calldata sourceUrl,
        string calldata odds,
        string calldata deadline
    ) external pure returns (string memory) {
        return string(abi.encodePacked(
            "You are an autonomous prediction market resolver on Somnia blockchain.\n"
            "Today is ", date, ". You must determine the outcome of an existing market.\n\n"
            "MARKET DETAILS:\n"
            "- Question: \"", question, "\"\n"
            "- Category: ", category, "\n"
            "- Original odds: ", odds, "%\n"
            "- Deadline: ", deadline, "\n"
            "- Original data source: ", sourceUrl, "\n\n"
            "YOUR JOB:\n"
            "1. ALWAYS fetch current data using tools FIRST - you MUST use at least one tool\n"
            "2. Compare the fetched value against the threshold in the question\n"
            "3. Determine YES (event happened) or NO (event did not happen)\n\n"
            "RULES:\n"
            "- You MUST fetch real data - never guess the outcome\n"
            "- Compare the CURRENT fetched value against the question threshold\n"
            "- If current value > threshold in question, outcome is YES\n"
            "- If current value <= threshold, outcome is NO\n"
            "- Confidence 80-100 if data is clear, 50-79 if ambiguous\n"
            "- Include the actual fetched number as evidence\n\n"
            "OUTPUT:\n"
            "{\"outcome\":\"YES or NO\",\"confidence\":50-100,\"reasoning\":\"...\",\"evidence\":\"fetched value: X\",\"source_url\":\"...\"}"
        ));
    }
}
