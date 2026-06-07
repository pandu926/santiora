// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V5Types.sol";
import "../interfaces/IAgentPlatform.sol";

/// @title V5ToolRouter - Maps LLM tool calldata to real JSON API requests
/// @notice Decodes tool selectors from LLM yield and returns (url, selector) for JSON agent
library V5ToolRouter {

    bytes4 constant SEL_FETCH_PRICE = bytes4(keccak256("fetchPrice(string)"));
    bytes4 constant SEL_FETCH_SPORTS = bytes4(keccak256("fetchSportsFixture(string)"));
    bytes4 constant SEL_FETCH_HEADLINE = bytes4(keccak256("fetchHeadline(string)"));
    bytes4 constant SEL_FETCH_JSON = bytes4(keccak256("fetchJSON(string,string)"));

    /// @notice Route a tool calldata to a JSON API url + selector
    /// @param calldata_ ABI-encoded calldata from LLM (4-byte selector + args)
    /// @return url The JSON API endpoint URL
    /// @return selector The JSON path selector for extraction
    function routeToolCall(bytes memory calldata_) internal pure returns (string memory url, string memory selector) {
        require(calldata_.length >= 4, "calldata too short");

        bytes4 sel = bytes4(_loadWord(calldata_, 0));

        bytes memory args = _stripSelector(calldata_);

        if (sel == SEL_FETCH_PRICE) {
            string memory symbol = abi.decode(args, (string));
            (url, selector) = _priceRoute(symbol);
        }
        else if (sel == SEL_FETCH_SPORTS) {
            string memory league = abi.decode(args, (string));
            (url, selector) = _sportsRoute(league);
        }
        else if (sel == SEL_FETCH_HEADLINE) {
            string memory topic = abi.decode(args, (string));
            (url, selector) = _headlineRoute(topic);
        }
        else if (sel == SEL_FETCH_JSON) {
            (url, selector) = abi.decode(args, (string, string));
        }
        else {
            revert("unknown tool selector");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ROUTE IMPLEMENTATIONS
    // ═══════════════════════════════════════════════════════════════

    function _priceRoute(string memory symbol) private pure returns (string memory url, string memory sel) {
        string memory coinId = _toCoinGeckoId(symbol);
        url = string(abi.encodePacked(
            "https://api.coingecko.com/api/v3/simple/price?ids=", coinId, "&vs_currencies=usd"
        ));
        sel = string(abi.encodePacked(coinId, ".usd"));
    }

    function _sportsRoute(string memory league) private pure returns (string memory url, string memory sel) {
        string memory leagueId = _toLeagueId(league);
        url = string(abi.encodePacked(
            "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=", leagueId
        ));
        sel = "events[0].strEvent";
    }

    function _headlineRoute(string memory topic) private pure returns (string memory url, string memory sel) {
        url = string(abi.encodePacked(
            "https://api.github.com/search/repositories?q=", topic, "&sort=stars&order=desc&per_page=1"
        ));
        sel = "items[0].full_name";
    }

    // ═══════════════════════════════════════════════════════════════
    // ID MAPPINGS
    // ═══════════════════════════════════════════════════════════════

    function _toCoinGeckoId(string memory symbol) private pure returns (string memory) {
        bytes32 h = keccak256(bytes(symbol));
        if (h == keccak256("BTC") || h == keccak256("btc") || h == keccak256("bitcoin")) return "bitcoin";
        if (h == keccak256("ETH") || h == keccak256("eth") || h == keccak256("ethereum")) return "ethereum";
        if (h == keccak256("SOL") || h == keccak256("sol") || h == keccak256("solana")) return "solana";
        if (h == keccak256("ADA") || h == keccak256("ada") || h == keccak256("cardano")) return "cardano";
        if (h == keccak256("DOT") || h == keccak256("dot") || h == keccak256("polkadot")) return "polkadot";
        if (h == keccak256("AVAX") || h == keccak256("avax")) return "avalanche-2";
        if (h == keccak256("LINK") || h == keccak256("link")) return "chainlink";
        if (h == keccak256("DOGE") || h == keccak256("doge")) return "dogecoin";
        if (h == keccak256("XRP") || h == keccak256("xrp")) return "ripple";
        if (h == keccak256("BNB") || h == keccak256("bnb")) return "binancecoin";
        return "bitcoin";
    }

    function _toLeagueId(string memory league) private pure returns (string memory) {
        bytes32 h = keccak256(bytes(league));
        if (h == keccak256("MLS") || h == keccak256("mls")) return "4346";
        if (h == keccak256("Premier League") || h == keccak256("EPL") || h == keccak256("epl")) return "4328";
        if (h == keccak256("La Liga") || h == keccak256("la liga")) return "4335";
        if (h == keccak256("Serie A") || h == keccak256("serie a")) return "4332";
        if (h == keccak256("Bundesliga") || h == keccak256("bundesliga")) return "4331";
        if (h == keccak256("Ligue 1") || h == keccak256("ligue 1")) return "4334";
        if (h == keccak256("Brazilian Serie A") || h == keccak256("brasileirao")) return "4351";
        if (h == keccak256("Argentine Primera") || h == keccak256("argentina")) return "4406";
        if (h == keccak256("NBA") || h == keccak256("nba")) return "4387";
        if (h == keccak256("NFL") || h == keccak256("nfl")) return "4391";
        return "4346";
    }

    // ═══════════════════════════════════════════════════════════════
    // BYTE UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /// @dev Load first 32 bytes from data (used to extract selector)
    function _loadWord(bytes memory data, uint256 offset) private pure returns (bytes32 result) {
        assembly {
            result := mload(add(add(data, 32), offset))
        }
    }

    /// @dev Strip 4-byte selector using assembly for gas efficiency
    function _stripSelector(bytes memory data) private pure returns (bytes memory) {
        require(data.length >= 4, "too short");
        uint256 newLen = data.length - 4;
        bytes memory stripped = new bytes(newLen);
        assembly {
            let src := add(data, 36)    // skip 32 (length) + 4 (selector)
            let dst := add(stripped, 32) // skip 32 (length)
            let remaining := newLen
            for {} gt(remaining, 31) {} {
                mstore(dst, mload(src))
                src := add(src, 32)
                dst := add(dst, 32)
                remaining := sub(remaining, 32)
            }
            if gt(remaining, 0) {
                let mask := sub(shl(mul(sub(32, remaining), 8), 1), 1)
                mstore(dst, and(mload(src), not(mask)))
            }
        }
        return stripped;
    }
}
