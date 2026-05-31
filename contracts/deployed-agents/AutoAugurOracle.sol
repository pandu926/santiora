// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";

/// @title AutoAugurOracle
/// @notice AI-powered oracle layer for the Somnia ecosystem
/// @dev Any dApp can query AutoAugur AI for probability predictions on real-world events.
///      Queries are processed by the LLM agent and responses are delivered via platform callback.
contract AutoAugurOracle {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_COST = 0.24 ether;

    struct OracleQuery {
        address requester;
        string question;
        uint256 probability;
        uint256 confidence;
        uint256 timestamp;
        bool answered;
        uint256 fee;
    }

    OracleQuery[] public queries;
    mapping(bytes32 => uint256) public questionToQuery;
    mapping(uint256 => uint256) public requestToQuery;

    uint256 public queryFee = 0.1 ether;
    uint256 public totalFeesCollected;
    uint256 public totalQueriesAnswered;

    // Events
    event OracleQueryCreated(uint256 indexed queryId, address indexed requester, string question);
    event OracleAnswered(uint256 indexed queryId, string question, uint256 probability, uint256 confidence);
    event QueryFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM_ADDRESS, "Only Agent Platform");
        _;
    }

    receive() external payable {}

    // =========================================================================
    // Query Submission
    // =========================================================================

    /// @notice Submit a question to the AI oracle
    /// @param question The question to get a probability prediction for
    /// @return queryId The ID to check for the answer later
    function query(string calldata question) external payable returns (uint256 queryId) {
        require(msg.value >= queryFee, "Insufficient fee");

        queryId = queries.length;
        bytes32 questionHash = keccak256(bytes(question));

        queries.push(OracleQuery({
            requester: msg.sender,
            question: question,
            probability: 0,
            confidence: 0,
            timestamp: block.timestamp,
            answered: false,
            fee: msg.value
        }));

        questionToQuery[questionHash] = queryId;
        totalFeesCollected += msg.value;

        // Trigger LLM agent to analyze the question
        _requestAIAnalysis(queryId, question);

        emit OracleQueryCreated(queryId, msg.sender, question);
    }

    /// @notice Submit multiple questions in a single transaction
    /// @param questions Array of questions to query
    /// @return queryIds Array of query IDs for each question
    function batchQuery(string[] calldata questions) external payable returns (uint256[] memory queryIds) {
        uint256 totalRequired = queryFee * questions.length;
        require(msg.value >= totalRequired, "Insufficient fee for batch");

        queryIds = new uint256[](questions.length);
        uint256 feePerQuery = msg.value / questions.length;

        for (uint256 i = 0; i < questions.length; i++) {
            uint256 queryId = queries.length;
            bytes32 questionHash = keccak256(bytes(questions[i]));

            queries.push(OracleQuery({
                requester: msg.sender,
                question: questions[i],
                probability: 0,
                confidence: 0,
                timestamp: block.timestamp,
                answered: false,
                fee: feePerQuery
            }));

            questionToQuery[questionHash] = queryId;
            queryIds[i] = queryId;

            _requestAIAnalysis(queryId, questions[i]);

            emit OracleQueryCreated(queryId, msg.sender, questions[i]);
        }

        totalFeesCollected += msg.value;
    }

    // =========================================================================
    // AI Response Handling (Platform Callback)
    // =========================================================================

    /// @notice Callback from the platform with the AI's analysis
    /// @dev Only callable by the Agent Platform after LLM processing
    function handleQueryResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external onlyPlatform {
        uint256 queryId = requestToQuery[requestId];
        OracleQuery storage q = queries[queryId];

        require(!q.answered, "Already answered");

        if (status != ResponseStatus.Success || responses.length == 0) {
            // Mark as answered with zero confidence to indicate failure
            q.answered = true;
            q.confidence = 0;
            totalQueriesAnswered++;
            emit OracleAnswered(queryId, q.question, 0, 0);
            return;
        }

        // Decode AI response as probability (0-100)
        int256 rawProbability = abi.decode(responses[0].result, (int256));

        // Clamp to valid range
        uint256 probability = rawProbability < 0 ? 0 : (rawProbability > 100 ? 100 : uint256(rawProbability));

        // Confidence based on consensus among validators
        uint256 confidence = _calculateConfidence(responses);

        q.probability = probability;
        q.confidence = confidence;
        q.answered = true;
        totalQueriesAnswered++;

        emit OracleAnswered(queryId, q.question, probability, confidence);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get the answer for a specific query ID
    /// @param queryId The query to check
    /// @return probability The predicted probability (0-100)
    /// @return confidence The confidence score (0-100)
    /// @return answered Whether the query has been answered
    function getAnswer(uint256 queryId) external view returns (uint256 probability, uint256 confidence, bool answered) {
        require(queryId < queries.length, "Query does not exist");
        OracleQuery storage q = queries[queryId];
        return (q.probability, q.confidence, q.answered);
    }

    /// @notice Get the answer by question text (hash lookup)
    /// @param question The original question text
    /// @return probability The predicted probability (0-100)
    /// @return confidence The confidence score (0-100)
    /// @return answered Whether the query has been answered
    function getAnswerByQuestion(string calldata question) external view returns (uint256 probability, uint256 confidence, bool answered) {
        bytes32 questionHash = keccak256(bytes(question));
        uint256 queryId = questionToQuery[questionHash];

        // Check if query exists (index 0 could be valid, so check requester)
        if (queryId == 0 && queries.length > 0) {
            bytes32 firstHash = keccak256(bytes(queries[0].question));
            if (firstHash != questionHash) {
                return (0, 0, false);
            }
        } else if (queries.length == 0) {
            return (0, 0, false);
        }

        OracleQuery storage q = queries[queryId];
        return (q.probability, q.confidence, q.answered);
    }

    /// @notice Get overall oracle statistics
    /// @return totalQueries Total number of queries submitted
    /// @return answered Number of queries that have been answered
    /// @return avgConfidence Average confidence across all answered queries
    /// @return feesCollected Total fees collected in wei
    function getOracleStats() external view returns (
        uint256 totalQueries,
        uint256 answered,
        uint256 avgConfidence,
        uint256 feesCollected
    ) {
        totalQueries = queries.length;
        answered = totalQueriesAnswered;
        feesCollected = totalFeesCollected;

        if (totalQueriesAnswered == 0) {
            avgConfidence = 0;
        } else {
            uint256 totalConfidence = 0;
            for (uint256 i = 0; i < queries.length; i++) {
                if (queries[i].answered) {
                    totalConfidence += queries[i].confidence;
                }
            }
            avgConfidence = totalConfidence / totalQueriesAnswered;
        }
    }

    // =========================================================================
    // Admin Functions (Platform-only — AI manages these)
    // =========================================================================

    /// @notice Adjust the query fee based on demand (AI-managed)
    /// @param newFee The new fee in wei
    function setQueryFee(uint256 newFee) external onlyPlatform {
        uint256 oldFee = queryFee;
        queryFee = newFee;
        emit QueryFeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraw collected fees to a specified address (AI-managed treasury)
    /// @param to The address to send fees to
    function withdrawFees(address to) external onlyPlatform {
        require(to != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success,) = to.call{value: balance}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(to, balance);
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /// @dev Send a request to the LLM agent to analyze the question
    function _requestAIAnalysis(uint256 queryId, string memory question) internal {
        string memory prompt = string.concat(
            "Analyze this prediction question and estimate the probability (0-100) that the answer is YES.\n\n",
            "Question: ", question, "\n\n",
            "Consider available evidence, historical patterns, and current trends. ",
            "Return ONLY a number between 0 and 100 representing the probability percentage."
        );

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferNumber.selector,
            prompt,
            "You are a calibrated probability oracle. Be precise and evidence-based.",
            int256(0),
            int256(100),
            true
        );

        (bool ok, bytes memory ret) = PLATFORM_ADDRESS.call{value: LLM_COST}(
            abi.encodeWithSignature("createRequest(uint256,address,bytes4,bytes)", LLM_AGENT_ID, address(this), this.handleQueryResponse.selector, payload)
        );
        require(ok, "platform call failed");
        uint256 reqId = abi.decode(ret, (uint256));
        requestToQuery[reqId] = queryId;
    }

    /// @dev Calculate confidence based on response consensus
    ///      If multiple validators agree, confidence is higher
    function _calculateConfidence(Response[] memory responses) internal pure returns (uint256) {
        if (responses.length <= 1) {
            return 70; // Single response = moderate confidence
        }

        // Decode all responses and check variance
        int256 firstValue = abi.decode(responses[0].result, (int256));
        uint256 agreementCount = 1;

        for (uint256 i = 1; i < responses.length; i++) {
            if (responses[i].status == ResponseStatus.Success) {
                int256 value = abi.decode(responses[i].result, (int256));
                // Within 10 points = agreement
                int256 diff = firstValue - value;
                if (diff < 0) diff = -diff;
                if (diff <= 10) {
                    agreementCount++;
                }
            }
        }

        // Confidence scales with agreement: 70 base + (agreement ratio * 30)
        uint256 confidence = 70 + ((agreementCount * 30) / responses.length);
        if (confidence > 100) {
            confidence = 100;
        }

        return confidence;
    }

}
