// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "./V4Types.sol";
import "./V4Helpers.sol";
import "../interfaces/IAgentPlatform.sol";

/// @title V4DataGatherer - Multi-source data gathering with per-market state
/// @notice Manages sequential batch gathering from JSON API (primary) + scraper (optional).
///         Handles null/empty responses gracefully with per-source feedback.
abstract contract V4DataGatherer {
    using V4Helpers for string;

    // ===========================================================================
    // STORAGE (inherited by SantioraV4)
    // ===========================================================================

    mapping(uint256 => uint256) internal _requestToMarket;
    mapping(uint256 => RequestPhase) internal _requestPhase;
    mapping(uint256 => bool) internal _requestConsumed;
    mapping(uint256 => string) internal _requestLabel;

    // ===========================================================================
    // DATA SOURCE REGISTRY
    // ===========================================================================

    /// @dev Active sports league IDs (verified June 2026). Update seasonally.
    function _sportsQueries(uint8 round) internal pure returns (DataQuery[] memory) {
        if (round == 1) {
            DataQuery[] memory q = new DataQuery[](3);
            q[0] = DataQuery("mls_fixture", "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4346", "events[0].strEvent");
            q[1] = DataQuery("mls_date", "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4346", "events[0].dateEvent");
            q[2] = DataQuery("mls_leader", "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].strTeam");
            return q;
        }
        if (round == 2) {
            DataQuery[] memory q = new DataQuery[](3);
            q[0] = DataQuery("mls_pts", "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].intPoints");
            q[1] = DataQuery("mls_form", "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].strForm");
            q[2] = DataQuery("brazil_fixture", "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4351", "events[0].strEvent");
            return q;
        }
        DataQuery[] memory q = new DataQuery[](2);
        q[0] = DataQuery("argentina_fixture", "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4406", "events[0].strEvent");
        q[1] = DataQuery("mls_second", "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[1].strTeam");
        return q;
    }

    function _cryptoQueries(uint8 round) internal pure returns (DataQuery[] memory) {
        if (round == 1) {
            DataQuery[] memory q = new DataQuery[](3);
            q[0] = DataQuery("btc_usd", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", "bitcoin.usd");
            q[1] = DataQuery("eth_usd", "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", "ethereum.usd");
            q[2] = DataQuery("sol_usd", "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", "solana.usd");
            return q;
        }
        DataQuery[] memory q = new DataQuery[](2);
        q[0] = DataQuery("btc_24h", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true", "bitcoin.usd_24h_change");
        q[1] = DataQuery("ada_usd", "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd", "cardano.usd");
        return q;
    }

    function _financeQueries(uint8 round) internal pure returns (DataQuery[] memory) {
        if (round == 1) {
            DataQuery[] memory q = new DataQuery[](3);
            q[0] = DataQuery("usd_eur", "https://open.er-api.com/v6/latest/USD", "rates.EUR");
            q[1] = DataQuery("usd_gbp", "https://open.er-api.com/v6/latest/USD", "rates.GBP");
            q[2] = DataQuery("usd_jpy", "https://open.er-api.com/v6/latest/USD", "rates.JPY");
            return q;
        }
        DataQuery[] memory q = new DataQuery[](2);
        q[0] = DataQuery("eur_usd", "https://open.er-api.com/v6/latest/EUR", "rates.USD");
        q[1] = DataQuery("gbp_usd", "https://open.er-api.com/v6/latest/GBP", "rates.USD");
        return q;
    }

    function _technologyQueries(uint8 round) internal pure returns (DataQuery[] memory) {
        DataQuery[] memory q = new DataQuery[](2);
        if (round == 1) {
            q[0] = DataQuery("gh_trending", "https://api.github.com/search/repositories?q=created:>2026-05-25&sort=stars&order=desc&per_page=3", "items[0].full_name");
            q[1] = DataQuery("gh_stars", "https://api.github.com/search/repositories?q=created:>2026-05-25&sort=stars&order=desc&per_page=3", "items[0].stargazers_count");
            return q;
        }
        q[0] = DataQuery("gh_ai", "https://api.github.com/search/repositories?q=topic:ai&sort=updated&order=desc&per_page=3", "items[0].full_name");
        q[1] = DataQuery("gh_ai_stars", "https://api.github.com/search/repositories?q=topic:ai&sort=updated&order=desc&per_page=3", "items[0].stargazers_count");
        return q;
    }

    /// @notice Get data queries for a category and round
    function _getQueries(string memory category, uint8 round) internal pure returns (DataQuery[] memory) {
        if (V4Helpers.equals(category, "sports")) return _sportsQueries(round);
        if (V4Helpers.equals(category, "crypto")) return _cryptoQueries(round);
        if (V4Helpers.equals(category, "finance")) return _financeQueries(round);
        if (V4Helpers.equals(category, "technology")) return _technologyQueries(round);
        return _sportsQueries(round);
    }

    /// @notice Get resolve-specific queries using stored source info
    function _getResolveQueries(SourceInfo storage src, uint8 round) internal view returns (DataQuery[] memory) {
        if (round == 1) {
            DataQuery[] memory q = new DataQuery[](2);
            q[0] = DataQuery("primary_source", src.url, src.selector);
            q[1] = DataQuery("primary_alt", src.url, "events[0].strStatus");
            return q;
        }
        DataQuery[] memory q = new DataQuery[](2);
        q[0] = DataQuery("deep_result", src.url, "events[0].strResult");
        q[1] = DataQuery("deep_teams", src.url, "events[0].strHomeTeam");
        return q;
    }

    // ===========================================================================
    // GATHER DISPATCH
    // ===========================================================================

    /// @notice Send batch of JSON API requests for a market
    function _dispatchGather(
        uint256 marketId,
        DataQuery[] memory queries,
        RequestPhase phase
    ) internal {
        for (uint256 i = 0; i < queries.length; i++) {
            bytes memory payload = abi.encodeWithSelector(
                IJsonApiAgent.fetchString.selector,
                queries[i].url,
                queries[i].selector
            );
            uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: JSON_DEPOSIT}(
                JSON_AGENT_ID,
                address(this),
                _gatherCallback(phase),
                payload
            );
            _requestToMarket[reqId] = marketId;
            _requestPhase[reqId] = phase;
            _requestLabel[reqId] = queries[i].label;
        }
    }

    /// @notice Resolve callback selector based on phase
    function _gatherCallback(RequestPhase phase) internal pure returns (bytes4) {
        if (phase == RequestPhase.CreateGather) return this.onCreateDataGathered.selector;
        return this.onResolveDataGathered.selector;
    }

    // ===========================================================================
    // CALLBACKS (to be implemented by SantioraV4)
    // ===========================================================================

    function onCreateDataGathered(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
    function onResolveDataGathered(uint256, Response[] memory, ResponseStatus, Request memory) external virtual;
}
