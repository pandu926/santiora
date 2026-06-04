// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

/// @title TestDeepResearch — Multi-tool data gathering + multi-LLM voting + research loop
/// @notice Flow:
///   ROUND n: gather dari banyak sumber (JSON API primary + Scraper best-effort)
///     → onData callback dgn FEEDBACK (sukses/gagal per sumber, retry sumber lain jika gagal)
///   VOTE: 3 LLM infer menilai "data cukup untuk bikin market bagus?"
///     → majority YES → CREATE market
///     → majority NO  → gather ROUND n+1 (sumber tambahan, pakai hint "what's missing")
///   maxRounds guard supaya tidak infinite loop
contract TestDeepResearch {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);
    uint256 public constant SCRAPER_ID = 12875401142070969085;
    uint256 public constant JSON_ID    = 13174292974160097713;
    uint256 public constant LLM_ID     = 12847293847561029384;
    uint256 public constant SUB_SIZE   = 3;
    uint256 public constant EXEC_COST  = 100000000000000000;
    uint256 public constant JSON_DEP   = 0.12 ether;

    uint8 constant REQ_DATA = 1;
    uint8 constant REQ_VOTE = 2;
    uint8 constant REQ_CREATE = 3;

    uint256 public round;
    uint256 public maxRounds = 3;

    // Gathered data accumulator
    string public dataContext;
    uint256 public sourcesOk;       // sukses count current round
    uint256 public sourcesPending;  // outstanding requests current round

    // Voting
    uint256 public votesYes;
    uint256 public votesNo;
    uint256 public votesPending;
    string  public missingHints;    // gabungan "what's missing" dari voter NO

    // Final
    bool   public marketDone;
    string public marketQuestion;
    uint256 public marketOdds;

    mapping(uint256 => uint8)  public reqType;
    mapping(uint256 => string) public reqLabel;
    mapping(uint256 => bool)   public reqDone;

    event DataResult(uint256 round, string label, uint8 status, uint256 chars);
    event DataFeedback(uint256 round, string msg);
    event VoteResult(uint256 round, uint256 yes, uint256 no, string verdict);
    event ResearchLoop(uint256 round, string reason);
    event MarketCreated(string question, uint256 odds);

    receive() external payable {}
    function scraperDep() public view returns (uint256) { return PLATFORM.getRequestDeposit() + EXEC_COST*SUB_SIZE; }

    address public owner = msg.sender;
    function withdraw() external { require(msg.sender==owner,"!owner"); (bool ok,)=payable(owner).call{value:address(this).balance}(""); require(ok); }

    // ═══════════════════════════════════════════════════════════════════════
    // ENTRY: start deep research
    // ═══════════════════════════════════════════════════════════════════════
    function start() external payable {
        round = 1;
        _gatherRound(1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 1: Gather data (per round, sumber bertambah tiap round)
    // ═══════════════════════════════════════════════════════════════════════
    function _gatherRound(uint256 r) internal {
        sourcesPending = 0;
        if (r == 1) {
            // Round 1: MLS — liga AKTIF (musim panas 2026), punya fixtures mendatang
            _json("mls_next",  "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4346", "events[0].strEvent");
            _json("mls_date",  "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4346", "events[0].dateEvent");
            _json("mls_top",   "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].strTeam");
        } else if (r == 2) {
            // Round 2: data lebih kaya — points, form, played dari klasemen MLS aktif
            _json("mls_pts",   "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].intPoints");
            _json("mls_form",  "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].strForm");
            _json("mls_played","https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[0].intPlayed");
            _json("mls_t2",    "https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4346&s=2026", "table[1].strTeam");
        } else {
            // Round 3: scraper best-effort + more JSON
            _scraper("espn_ctx", "https://www.espn.com/soccer/scoreboard", "recent soccer results scores dates");
            _json("eth_price", "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", "ethereum.usd");
        }
    }

    function _json(string memory lbl, string memory url, string memory sel) internal {
        bytes memory payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, url, sel);
        uint256 rid = PLATFORM.createRequest{value: JSON_DEP}(JSON_ID, address(this), this.onData.selector, payload);
        reqType[rid]=REQ_DATA; reqLabel[rid]=lbl; sourcesPending++;
    }

    function _scraper(string memory lbl, string memory url, string memory q) internal {
        string[] memory opts = new string[](0);
        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector, q, q, opts, q, url, false, uint8(2), uint8(30));
        uint256 rid = PLATFORM.createRequest{value: scraperDep()}(SCRAPER_ID, address(this), this.onData.selector, payload);
        reqType[rid]=REQ_DATA; reqLabel[rid]=lbl; sourcesPending++;
    }

    function onData(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;

        string memory lbl = reqLabel[reqId];
        if (s == ResponseStatus.Success && r.length > 0) {
            string memory val = abi.decode(r[0].result, (string));
            if (bytes(val).length > 0) {
                dataContext = string.concat(dataContext, "[", lbl, "]=", val, "; ");
                sourcesOk++;
                emit DataResult(round, lbl, uint8(s), bytes(val).length);
            } else {
                emit DataFeedback(round, string.concat(lbl, " empty -> skip"));
            }
        } else {
            // FEEDBACK: sumber gagal
            emit DataFeedback(round, string.concat(lbl, " FAILED status=", _u2s(uint8(s))));
        }

        if (sourcesPending > 0) sourcesPending--;
        // Semua sumber round ini selesai → mulai voting
        if (sourcesPending == 0) _startVoting();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 2: Multi-LLM Voting — apakah data cukup?
    // ═══════════════════════════════════════════════════════════════════════
    function _startVoting() internal {
        // Jika data kosong total → langsung loop (jangan buang LLM call)
        if (bytes(dataContext).length < 20) {
            emit DataFeedback(round, "data too thin, skip voting -> research loop");
            _researchLoopOrFail("no_data");
            return;
        }
        votesYes=0; votesNo=0; votesPending=3; missingHints="";
        for (uint256 i=0; i<3; i++) _askVote(i);
    }

    function _askVote(uint256 voterIdx) internal {
        string[] memory roles=new string[](2); string[] memory msgs=new string[](2);
        roles[0]="system"; roles[1]="user";
        msgs[0]="You are a data-sufficiency judge for an autonomous prediction market protocol. "
                "Your ONLY job: decide if the gathered data is enough to BUILD a fair YES/NO market about a FUTURE event.\n\n"
                "IMPORTANT MINDSET: A prediction market asks about an outcome that has NOT happened yet. "
                "The winner/result being UNKNOWN is REQUIRED, not a flaw. Do NOT reject data for 'missing outcome' "
                "or 'missing winner' - the unknown future outcome is the entire point of the market.\n\n"
                "Vote sufficient=TRUE if the data contains ALL THREE:\n"
                "  1. ENTITIES: named participants (e.g. two teams, an asset, a person).\n"
                "  2. A FUTURE ANCHOR: a future date/fixture/deadline the question can resolve against "
                "(e.g. an upcoming match date, or a current value that will change).\n"
                "  3. RESOLVABILITY: the same data source could be re-queried later to determine YES/NO "
                "(e.g. match result, final score, or whether a price crossed a threshold).\n\n"
                "Vote sufficient=FALSE ONLY if a REQUIRED piece is truly absent - for example: no named entities, "
                "OR no future date/anchor at all, OR the outcome could never be verified from any data source.\n\n"
                "Example SUFFICIENT: data has 'Team A vs Team B on 2026-07-16' + league standings. "
                "-> You can ask 'Will Team A beat Team B on 2026-07-16?' resolvable by match result. Vote TRUE.\n"
                "Example INSUFFICIENT: data has only a team name and nothing else - no opponent, no date. Vote FALSE.\n\n"
                "Reply ONLY valid JSON: {\"sufficient\":true,\"missing\":\"\"} "
                "or {\"sufficient\":false,\"missing\":\"the ONE required element that is absent\"}.";
        msgs[1]=string.concat("Voter #", _u2s(uint8(voterIdx)), ". Evaluate this gathered data:\n", dataContext);
        _llm(msgs, this.onVote.selector, REQ_VOTE, string.concat("vote_", _u2s(uint8(voterIdx))));
    }

    function onVote(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;

        if (s == ResponseStatus.Success && r.length > 0) {
            string memory resp; (, resp,,,,) = abi.decode(r[0].result,(string,string,string[],string[],string[],bytes[]));
            if (_findBool(resp, "sufficient")) votesYes++;
            else { votesNo++; string memory m=_jsonStr(resp,"missing"); if(bytes(m).length>0) missingHints=string.concat(missingHints, m, "; "); }
        } else {
            votesNo++; // gagal vote = konservatif (anggap belum cukup)
        }

        if (votesPending>0) votesPending--;
        if (votesPending==0) _tallyVotes();
    }

    function _tallyVotes() internal {
        if (votesYes >= 2) {
            emit VoteResult(round, votesYes, votesNo, "SUFFICIENT");
            _createMarket();
        } else {
            emit VoteResult(round, votesYes, votesNo, "INSUFFICIENT");
            _researchLoopOrFail("votes_insufficient");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESEARCH LOOP: gather lagi atau menyerah
    // ═══════════════════════════════════════════════════════════════════════
    function _researchLoopOrFail(string memory reason) internal {
        if (round >= maxRounds) {
            emit ResearchLoop(round, string.concat("max rounds reached, giving up: ", reason));
            // tetap coba create dgn data seadanya jika ada
            if (bytes(dataContext).length >= 20) _createMarket();
            return;
        }
        round++;
        emit ResearchLoop(round, string.concat("gathering more. missing: ", missingHints));
        _gatherRound(round);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 3: Create market dgn semua data terkumpul
    // ═══════════════════════════════════════════════════════════════════════
    function _createMarket() internal {
        string[] memory roles=new string[](2); string[] memory msgs=new string[](2);
        roles[0]="system"; roles[1]="user";
        msgs[0]="Create ONE YES/NO prediction market from this multi-source data. "
                "Use SPECIFIC entities and values from data. Question about FUTURE event, "
                "resolvable from same data sources. odds 40-60. Do NOT invent facts not in data. "
                "Reply ONLY JSON: {\"question\":\"...\",\"odds\":50,\"deadline_hours\":48}. Today June 2026.";
        msgs[1]=dataContext;
        _llm(msgs, this.onCreate.selector, REQ_CREATE, "create");
    }

    function onCreate(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;
        marketDone=true;
        if (s==ResponseStatus.Success && r.length>0) {
            string memory resp; (, resp,,,,)=abi.decode(r[0].result,(string,string,string[],string[],string[],bytes[]));
            marketQuestion=_jsonStr(resp,"question");
            marketOdds=_jsonUint(resp,"odds");
            if(bytes(marketQuestion).length==0) marketQuestion=resp;
            if(marketOdds==0) marketOdds=50;
        }
        emit MarketCreated(marketQuestion, marketOdds);
    }

    function _llm(string[] memory msgs, bytes4 cb, uint8 typ, string memory lbl) internal {
        string[] memory roles=new string[](2); roles[0]="system"; roles[1]="user";
        string[] memory mcp=new string[](0); OnchainTool[] memory tools=new OnchainTool[](0);
        bytes memory payload=abi.encodeWithSelector(IToolsAgent.inferToolsChat.selector,roles,msgs,mcp,tools,uint256(0),false);
        uint256 rid=PLATFORM.createRequest{value:scraperDep()}(LLM_ID,address(this),cb,payload);
        reqType[rid]=typ; reqLabel[rid]=lbl;
    }

    // ─── helpers ─────────────────────────────────────────────────────────────
    function _findBool(string memory j, string memory k) internal pure returns(bool){
        bytes memory d=bytes(j); bytes memory n=bytes(string.concat('"',k,'":')); uint256 s=_f(d,n);
        if(s==type(uint256).max) return false; s+=n.length;
        while(s<d.length&&d[s]==' ')s++;
        return s+4<=d.length && d[s]=='t'&&d[s+1]=='r'&&d[s+2]=='u'&&d[s+3]=='e';
    }
    function _jsonStr(string memory j,string memory k) internal pure returns(string memory){
        bytes memory d=bytes(j);bytes memory n=bytes(string.concat('"',k,'":'));uint256 s=_f(d,n);if(s==type(uint256).max)return"";s+=n.length;
        while(s<d.length&&(d[s]==' '||d[s]=='\t'||d[s]=='\n'||d[s]=='\r'))s++;if(s>=d.length||d[s]!='"')return"";s++;uint256 e=s;
        while(e<d.length&&d[e]!='"'){if(d[e]=='\\'&&e+1<d.length)e++;e++;}return _sl(d,s,e);
    }
    function _jsonUint(string memory j,string memory k) internal pure returns(uint256){
        bytes memory d=bytes(j);bytes memory n=bytes(string.concat('"',k,'":'));uint256 s=_f(d,n);if(s==type(uint256).max)return 0;s+=n.length;
        while(s<d.length&&(d[s]<'0'||d[s]>'9'))s++;uint256 v;while(s<d.length&&d[s]>='0'&&d[s]<='9'){v=v*10+uint8(d[s])-48;s++;}return v;
    }
    function _f(bytes memory h,bytes memory n) internal pure returns(uint256){
        if(n.length==0||n.length>h.length)return type(uint256).max;
        for(uint256 i=0;i<=h.length-n.length;i++){bool m=true;for(uint256 j=0;j<n.length;j++)if(h[i+j]!=n[j]){m=false;break;}if(m)return i;}
        return type(uint256).max;
    }
    function _sl(bytes memory d,uint256 s,uint256 e) internal pure returns(string memory){bytes memory o=new bytes(e-s);for(uint256 i=0;i<o.length;i++)o[i]=d[s+i];return string(o);}
    function _u2s(uint256 v) internal pure returns(string memory){if(v==0)return"0";uint256 t=v;uint256 dg;while(t!=0){dg++;t/=10;}bytes memory b=new bytes(dg);while(v!=0){dg--;b[dg]=bytes1(uint8(48+v%10));v/=10;}return string(b);}
}