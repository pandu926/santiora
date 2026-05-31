// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

interface IPredictionMarketSUSD {
    function question() external view returns (string memory);
    function deadline() external view returns (uint256);
    function category() external view returns (bytes32);
    function status() external view returns (uint8);
    function setResolving() external;
    function resolve(bool _outcome, uint256 _confidence, string calldata _reasoning) external;
    function getResolutionSources() external view returns (string[] memory);
}

contract ConsensusResolver {
    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant WEB_SCRAPER_AGENT_ID = 12875401142070969085;
    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    uint256 public constant SUBCOMMITTEE_SIZE = 3;
    uint256 public constant THRESHOLD = 2;
    uint256 public constant CONSENSUS_TIMEOUT = 300;
    uint256 public constant CONFIDENCE_THRESHOLD = 80;
    uint256 public constant RETRY_DELAY = 21600; // 6 hours
    uint256 public constant PER_AGENT_COST = 0.07 ether;

    enum JobStep { Idle, Scraping, ApiCheck, Scoring, Done, Delayed }

    struct ResolutionJob {
        address market;
        JobStep step;
        string evidence;
        string apiData;
        uint256 confidence;
        uint256 startedAt;
        uint256 retryAfter;
        uint8 retryCount;
    }

    mapping(uint256 => ResolutionJob) public jobs;
    mapping(uint256 => uint256) public reqToJob;
    mapping(address => uint256) public marketToJob;
    uint256 public jobCount;

    event ResolutionStarted(address indexed market, uint256 jobId);
    event EvidenceCollected(uint256 indexed jobId, string evidence);
    event ResolutionCompleted(address indexed market, bool outcome, uint256 confidence, string reasoning);
    event ResolutionDelayed(address indexed market, uint256 confidence, uint256 retryAfter);
    event ResolutionFailed(uint256 indexed jobId, string reason);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "!platform");
        _;
    }

    receive() external payable {}

    function startResolution(address market) external payable returns (uint256 jobId) {
        IPredictionMarketSUSD m = IPredictionMarketSUSD(market);
        uint8 mStatus = m.status();
        // MarketStatus: 0=Created, 1=Active, 2=Resolving, 3=Resolved, 4=Settled
        require(mStatus == 1 || mStatus == 2, "Market not active/resolving");
        require(block.timestamp >= m.deadline(), "Deadline not reached");

        uint256 existingJob = marketToJob[market];
        if (existingJob > 0) {
            ResolutionJob storage existing = jobs[existingJob];
            if (existing.step == JobStep.Delayed) {
                require(block.timestamp >= existing.retryAfter, "Retry delay not elapsed");
            } else if (existing.step != JobStep.Idle) {
                revert("Resolution already in progress");
            }
        }

        if (mStatus == 1) {
            m.setResolving();
        }

        jobId = ++jobCount;
        jobs[jobId].market = market;
        jobs[jobId].step = JobStep.Scraping;
        jobs[jobId].startedAt = block.timestamp;
        marketToJob[market] = jobId;

        string memory q = m.question();
        string memory prompt = string.concat(
            "Find factual evidence: '", q,
            "'. Did this happen? Return YES or NO with source."
        );

        string[] memory options = new string[](2);
        options[0] = "YES";
        options[1] = "NO";

        bytes memory payload = abi.encodeWithSignature(
            "ExtractString(string,string,string[],string,string,bool,uint8,uint8)",
            "outcome",
            "Factual outcome of prediction market question",
            options,
            prompt,
            "https://www.google.com/search",
            true,
            uint8(3),
            uint8(60)
        );

        uint256 deposit = _getDeposit();
        uint256 reqId = _callAdvanced(WEB_SCRAPER_AGENT_ID, this.onEvidenceReceived.selector, payload, deposit);
        reqToJob[reqId] = jobId;

        emit ResolutionStarted(market, jobId);
    }

    function onEvidenceReceived(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 jobId = reqToJob[requestId];
        ResolutionJob storage job = jobs[jobId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            job.step = JobStep.Idle;
            emit ResolutionFailed(jobId, "Evidence scraping failed");
            return;
        }

        uint256 yesCount;
        uint256 noCount;
        string memory lastResult;

        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status == ResponseStatus.Success && responses[i].result.length > 0) {
                string memory r = abi.decode(responses[i].result, (string));
                lastResult = r;
                if (_containsYes(r)) {
                    yesCount++;
                } else {
                    noCount++;
                }
            }
        }

        job.evidence = yesCount >= noCount ? "YES" : "NO";
        emit EvidenceCollected(jobId, job.evidence);

        bytes32 cat = IPredictionMarketSUSD(job.market).category();
        if (cat == bytes32("crypto") || cat == bytes32("economy")) {
            _requestApiData(jobId);
        } else {
            _requestConfidenceScore(jobId);
        }
    }

    function _requestApiData(uint256 jobId) internal {
        ResolutionJob storage job = jobs[jobId];
        job.step = JobStep.ApiCheck;

        string memory q = IPredictionMarketSUSD(job.market).question();
        bytes memory payload = abi.encodeWithSignature(
            "fetchString(string,string)",
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
            "$.bitcoin.usd"
        );

        uint256 deposit = _getDeposit();
        uint256 reqId = _callAdvanced(JSON_API_AGENT_ID, this.onApiDataReceived.selector, payload, deposit);
        reqToJob[reqId] = jobId;
    }

    function onApiDataReceived(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 jobId = reqToJob[requestId];
        ResolutionJob storage job = jobs[jobId];

        if (status == ResponseStatus.Success && responses.length > 0 && responses[0].result.length > 0) {
            job.apiData = abi.decode(responses[0].result, (string));
        } else {
            job.apiData = "API data unavailable";
        }

        _requestConfidenceScore(jobId);
    }

    function _requestConfidenceScore(uint256 jobId) internal {
        ResolutionJob storage job = jobs[jobId];
        job.step = JobStep.Scoring;

        string memory q = IPredictionMarketSUSD(job.market).question();
        string memory prompt = string.concat(
            "Prediction: '", q,
            "'. Evidence from web scraping: ", job.evidence,
            ". API data: ", job.apiData,
            ". Is the outcome ", job.evidence,
            " correct? Score confidence 0-100."
        );

        bytes memory payload = abi.encodeWithSignature(
            "inferNumber(string,string,int256,int256,bool)",
            prompt,
            "Resolution confidence scorer. Return 0-100 based on evidence strength.",
            int256(0),
            int256(100),
            true
        );

        uint256 deposit = _getDeposit();
        uint256 reqId = _callAdvanced(LLM_AGENT_ID, this.onConfidenceScored.selector, payload, deposit);
        reqToJob[reqId] = jobId;
    }

    function onConfidenceScored(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 jobId = reqToJob[requestId];
        ResolutionJob storage job = jobs[jobId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            job.step = JobStep.Idle;
            emit ResolutionFailed(jobId, "Confidence scoring failed");
            return;
        }

        uint256 totalConf;
        uint256 validCount;
        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status == ResponseStatus.Success && responses[i].result.length > 0) {
                int256 raw = abi.decode(responses[i].result, (int256));
                if (raw >= 0 && raw <= 100) {
                    totalConf += uint256(raw);
                    validCount++;
                }
            }
        }

        uint256 avgConfidence = validCount > 0 ? totalConf / validCount : 0;
        job.confidence = avgConfidence;

        if (avgConfidence >= CONFIDENCE_THRESHOLD) {
            bool outcomeResult = _isYes(job.evidence);
            string memory reasoning = string.concat(
                "Consensus resolution (", _uint2str(validCount),
                " validators, ", _uint2str(avgConfidence),
                "% confidence): ", job.evidence
            );

            job.step = JobStep.Done;
            IPredictionMarketSUSD(job.market).resolve(outcomeResult, avgConfidence, reasoning);
            emit ResolutionCompleted(job.market, outcomeResult, avgConfidence, reasoning);
        } else {
            job.step = JobStep.Delayed;
            job.retryAfter = block.timestamp + RETRY_DELAY;
            job.retryCount++;
            emit ResolutionDelayed(job.market, avgConfidence, job.retryAfter);
        }
    }

    function _callAdvanced(uint256 agentId, bytes4 cb, bytes memory payload, uint256 deposit) internal returns (uint256) {
        (bool ok, bytes memory ret) = PLATFORM.call{value: deposit}(
            abi.encodeWithSignature(
                "createAdvancedRequest(uint256,address,bytes4,bytes,uint256,uint256,uint8,uint256)",
                agentId, address(this), cb, payload,
                SUBCOMMITTEE_SIZE, THRESHOLD, uint8(ConsensusType.Majority), CONSENSUS_TIMEOUT
            )
        );
        require(ok, "platform call failed");
        return abi.decode(ret, (uint256));
    }

    function _getDeposit() internal view returns (uint256) {
        (bool ok, bytes memory ret) = PLATFORM.staticcall(
            abi.encodeWithSignature("getRequestDeposit()")
        );
        uint256 base = ok && ret.length >= 32 ? abi.decode(ret, (uint256)) : 0;
        return base + (PER_AGENT_COST * SUBCOMMITTEE_SIZE);
    }

    function _containsYes(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i + 2 < b.length; i++) {
            if ((b[i] == 'Y' || b[i] == 'y') &&
                (b[i+1] == 'E' || b[i+1] == 'e') &&
                (b[i+2] == 'S' || b[i+2] == 's')) {
                return true;
            }
        }
        return false;
    }

    function _isYes(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        if (b.length >= 3 &&
            (b[0] == 'Y' || b[0] == 'y') &&
            (b[1] == 'E' || b[1] == 'e') &&
            (b[2] == 'S' || b[2] == 's')) {
            return true;
        }
        return false;
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

    function getJob(uint256 jobId) external view returns (
        address market, uint8 step, string memory evidence,
        string memory apiData, uint256 confidence,
        uint256 startedAt, uint256 retryAfter, uint8 retryCount
    ) {
        ResolutionJob storage j = jobs[jobId];
        return (j.market, uint8(j.step), j.evidence, j.apiData, j.confidence, j.startedAt, j.retryAfter, j.retryCount);
    }

    function getMarketResolutionStatus(address market) external view returns (
        uint8 step, uint256 confidence, uint256 retryAfter, uint8 retryCount
    ) {
        uint256 jobId = marketToJob[market];
        if (jobId == 0) return (0, 0, 0, 0);
        ResolutionJob storage j = jobs[jobId];
        return (uint8(j.step), j.confidence, j.retryAfter, j.retryCount);
    }
}
