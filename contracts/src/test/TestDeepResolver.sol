// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAgentPlatform.sol";

/// @title TestDeepResolver — Resolve market via deep research + voting
/// @notice Skenario: market "Will Arsenal win the 2025-26 UCL final vs PSG?"
///         Event PSG vs Arsenal 2026-05-30 berakhir 1-1, PSG menang 4-3 penalti.
///         Skor 1-1 menyesatkan -> resolver harus gather lebih dalam (strResult)
///         untuk tentukan pemenang sebelum resolve.
/// Flow:
///   ROUND 1: gather skor + status -> VOTE "cukup untuk resolve confident?"
///     score 1-1 + PEN ambiguous -> vote INSUFFICIENT -> loop
///   ROUND 2: gather strResult (narasi pemenang) -> VOTE sufficient -> RESOLVE
///   RESOLVE LLM: baca semua data -> tentukan YES/NO + confidence
contract TestDeepResolver {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);
    uint256 public constant JSON_ID = 13174292974160097713;
    uint256 public constant LLM_ID  = 12847293847561029384;
    uint256 public constant SUB_SIZE = 3;
    uint256 public constant EXEC_COST = 100000000000000000;
    uint256 public constant JSON_DEP = 0.12 ether;

    // ── MARKET yang akan di-resolve (skenario: kita "punya" market ini) ──
    string public constant MARKET_Q = "Will Arsenal win the 2025-26 UEFA Champions League final against PSG (played 2026-05-30)?";
    string constant EVT = "https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=2470477";

    uint256 public round;
    uint256 public maxRounds = 3;
    string  public dataContext;
    uint256 public sourcesPending;

    uint256 public votesYes;  // "cukup untuk resolve"
    uint256 public votesNo;
    uint256 public votesPending;
    string  public missingHints;

    bool    public resolveDone;
    string  public outcome;       // "YES" / "NO"
    uint256 public confidence;
    string  public resolveRaw;

    mapping(uint256 => bool)   public reqDone;
    mapping(uint256 => string) public reqLabel;

    event DataResult(uint256 round, string label, uint8 status, uint256 chars);
    event DataFeedback(uint256 round, string msg);
    event VoteResult(uint256 round, uint256 yes, uint256 no, string verdict);
    event ResearchLoop(uint256 round, string reason);
    event Resolved(string outcome, uint256 confidence);

    address public owner = msg.sender;
    receive() external payable {}
    function withdraw() external { require(msg.sender==owner); (bool ok,)=payable(owner).call{value:address(this).balance}(""); require(ok); }
    function dep() public view returns (uint256) { return PLATFORM.getRequestDeposit() + EXEC_COST*SUB_SIZE; }

    function start() external payable { round=1; _gather(1); }

    // ── LAYER 1: gather (per round makin dalam) ──
    function _gather(uint256 r) internal {
        sourcesPending=0;
        if (r == 1) {
            // Round 1: data dangkal — skor + status (sengaja minim & menyesatkan)
            _json("home_score", "results[0].intHomeScore");
            _json("away_score", "results[0].intAwayScore");
            _json("status",     "results[0].strStatus");
        } else if (r == 2) {
            // Round 2: data dalam — narasi hasil (berisi pemenang sebenarnya)
            _jsonLookup("result_text", "events[0].strResult");
            _jsonLookup("home_team",   "events[0].strHomeTeam");
            _jsonLookup("away_team",   "events[0].strAwayTeam");
        } else {
            _jsonLookup("season", "events[0].strSeason");
        }
    }

    // eventslast-style endpoint pakai "results[0]"
    function _json(string memory lbl, string memory sel) internal {
        // gunakan lookupevent (root "events[0]") — tapi selector results untuk variasi; fallback ke lookup
        _jsonLookup(lbl, sel);
    }
    function _jsonLookup(string memory lbl, string memory sel) internal {
        // koreksi selector: lookupevent root = events[0]
        bytes memory selB = bytes(sel);
        // jika selector pakai "results[0]" ubah ke "events[0]"
        string memory finalSel = _startsWith(sel, "results[0]") ? string.concat("events[0]", _slice(selB, 10, selB.length)) : sel;
        bytes memory payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, EVT, finalSel);
        uint256 rid = PLATFORM.createRequest{value: JSON_DEP}(JSON_ID, address(this), this.onData.selector, payload);
        reqLabel[rid]=lbl; sourcesPending++;
    }

    function onData(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;
        string memory lbl = reqLabel[reqId];
        if (s == ResponseStatus.Success && r.length > 0) {
            string memory v = abi.decode(r[0].result, (string));
            if (bytes(v).length > 0) {
                // batasi panjang per field supaya context tidak meledak (strResult 2279 chars)
                if (bytes(v).length > 600) v = _slice(bytes(v), 0, 600);
                dataContext = string.concat(dataContext, "[", lbl, "]=", v, "; ");
                emit DataResult(round, lbl, uint8(s), bytes(v).length);
            } else emit DataFeedback(round, string.concat(lbl, " empty"));
        } else emit DataFeedback(round, string.concat(lbl, " FAILED"));
        if (sourcesPending>0) sourcesPending--;
        if (sourcesPending==0) _vote();
    }

    // ── LAYER 2: voting — cukup untuk RESOLVE confident? ──
    function _vote() internal {
        if (bytes(dataContext).length < 15) { _loopOrFail("no_data"); return; }
        votesYes=0; votesNo=0; votesPending=3; missingHints="";
        for (uint256 i=0;i<3;i++) _askVote(i);
    }

    function _askVote(uint256 idx) internal {
        string[] memory msgs=new string[](2);
        msgs[0]="You are a resolution-readiness judge for an autonomous prediction market. "
                "A market question must be resolved to YES or NO using ONLY the gathered data. "
                "Your job: decide if the data is sufficient to resolve the SPECIFIC question CONFIDENTLY.\n\n"
                "CRITICAL: Do not accept ambiguous data. For a match decided by penalties, a score like '1-1' "
                "is NOT enough to know who WON - you need the shootout result or an explicit winner statement. "
                "Only vote sufficient=true if the data UNAMBIGUOUSLY determines the answer to the question.\n\n"
                "Vote sufficient=TRUE only if: the data clearly states the final result/winner needed to answer "
                "the exact question (e.g. an explicit 'Team X defeated Team Y' or a decisive scoreline).\n"
                "Vote sufficient=FALSE if: the result is ambiguous (draw score with no winner), the data is about "
                "a different event, or the decisive outcome (e.g. penalty winner) is missing.\n\n"
                "Reply ONLY JSON: {\"sufficient\":true,\"missing\":\"\"} or "
                "{\"sufficient\":false,\"missing\":\"the exact fact needed to resolve confidently\"}.";
        msgs[1]=string.concat("Voter #", _u2s(uint8(idx)), ". QUESTION TO RESOLVE: ", MARKET_Q,
                "\nGathered data: ", dataContext);
        _llm(msgs, this.onVote.selector);
    }

    function onVote(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;
        if (s==ResponseStatus.Success && r.length>0) {
            string memory resp; (, resp,,,,)=abi.decode(r[0].result,(string,string,string[],string[],string[],bytes[]));
            if (_findBool(resp,"sufficient")) votesYes++;
            else { votesNo++; string memory m=_jsonStr(resp,"missing"); if(bytes(m).length>0) missingHints=string.concat(missingHints,m,"; "); }
        } else votesNo++;
        if (votesPending>0) votesPending--;
        if (votesPending==0) {
            if (votesYes>=2) { emit VoteResult(round,votesYes,votesNo,"SUFFICIENT"); _resolve(); }
            else { emit VoteResult(round,votesYes,votesNo,"INSUFFICIENT"); _loopOrFail("ambiguous"); }
        }
    }

    function _loopOrFail(string memory reason) internal {
        if (round >= maxRounds) {
            emit ResearchLoop(round, string.concat("max rounds, force resolve: ", reason));
            if (bytes(dataContext).length>=15) _resolve();
            return;
        }
        round++;
        emit ResearchLoop(round, string.concat("need more. missing: ", missingHints));
        _gather(round);
    }

    // ── LAYER 3: resolve ──
    function _resolve() internal {
        string[] memory msgs=new string[](2);
        msgs[0]="You are the final resolver for a prediction market. Using ONLY the gathered data, "
                "answer the question with YES or NO and a confidence 0-100. "
                "Read carefully: a match can end level in regular/extra time but be decided by a penalty shootout - "
                "the shootout winner is the true winner. Base your answer strictly on the data; do not invent. "
                "Reply ONLY JSON: {\"outcome\":\"YES\" or \"NO\",\"confidence\":95,\"reasoning\":\"brief\"}.";
        msgs[1]=string.concat("QUESTION: ", MARKET_Q, "\nData: ", dataContext);
        _llm(msgs, this.onResolve.selector);
    }

    function onResolve(uint256 reqId, Response[] memory r, ResponseStatus s, Request memory) external {
        require(msg.sender == address(PLATFORM), "only platform");
        if (reqDone[reqId]) return; reqDone[reqId]=true;
        resolveDone=true;
        if (s==ResponseStatus.Success && r.length>0) {
            (, resolveRaw,,,,)=abi.decode(r[0].result,(string,string,string[],string[],string[],bytes[]));
            string memory o=_jsonStr(resolveRaw,"outcome");
            outcome = (_eq(o,"YES")||_eq(o,"yes")) ? "YES" : "NO";
            confidence=_jsonUint(resolveRaw,"confidence");
        }
        emit Resolved(outcome, confidence);
    }

    function _llm(string[] memory msgs, bytes4 cb) internal {
        string[] memory roles=new string[](2); roles[0]="system"; roles[1]="user";
        string[] memory mcp=new string[](0); OnchainTool[] memory tools=new OnchainTool[](0);
        bytes memory payload=abi.encodeWithSelector(IToolsAgent.inferToolsChat.selector,roles,msgs,mcp,tools,uint256(0),false);
        PLATFORM.createRequest{value:dep()}(LLM_ID,address(this),cb,payload);
    }

    // ── helpers ──
    function _startsWith(string memory s, string memory p) internal pure returns(bool){
        bytes memory sb=bytes(s); bytes memory pb=bytes(p);
        if(pb.length>sb.length) return false;
        for(uint256 i=0;i<pb.length;i++) if(sb[i]!=pb[i]) return false;
        return true;
    }
    function _eq(string memory a,string memory b) internal pure returns(bool){return keccak256(bytes(a))==keccak256(bytes(b));}
    function _findBool(string memory j,string memory k) internal pure returns(bool){
        bytes memory d=bytes(j);bytes memory n=bytes(string.concat('"',k,'":'));uint256 s=_f(d,n);if(s==type(uint256).max)return false;s+=n.length;
        while(s<d.length&&d[s]==' ')s++;return s+4<=d.length&&d[s]=='t'&&d[s+1]=='r'&&d[s+2]=='u'&&d[s+3]=='e';
    }
    function _jsonStr(string memory j,string memory k) internal pure returns(string memory){
        bytes memory d=bytes(j);bytes memory n=bytes(string.concat('"',k,'":'));uint256 s=_f(d,n);if(s==type(uint256).max)return"";s+=n.length;
        while(s<d.length&&(d[s]==' '||d[s]=='\t'||d[s]=='\n'||d[s]=='\r'))s++;if(s>=d.length||d[s]!='"')return"";s++;uint256 e=s;
        while(e<d.length&&d[e]!='"'){if(d[e]=='\\'&&e+1<d.length)e++;e++;}return _slice(d,s,e);
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
    function _slice(bytes memory d,uint256 s,uint256 e) internal pure returns(string memory){bytes memory o=new bytes(e-s);for(uint256 i=0;i<o.length;i++)o[i]=d[s+i];return string(o);}
    function _u2s(uint256 v) internal pure returns(string memory){if(v==0)return"0";uint256 t=v;uint256 dg;while(t!=0){dg++;t/=10;}bytes memory b=new bytes(dg);while(v!=0){dg--;b[dg]=bytes1(uint8(48+v%10));v/=10;}return string(b);}
}