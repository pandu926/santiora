# AI Agents

Santiora uses Somnia's native Agent Platform to execute AI reasoning on-chain. Every agent call is a transaction — inputs, outputs, and costs are fully verifiable on the block explorer.

## Agent Platform

The Somnia Agent Platform (`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`) is a predeployed proxy contract that routes requests to registered AI agents. Each agent has a unique numeric ID and executes specific capabilities.

### Registered Agents

| Agent ID | Type | Capability |
|----------|------|------------|
| `12847293847561029384` | LLM Inference | General-purpose text generation (Qwen3-30B) |
| `13174292974160097713` | JSON API Request | HTTP fetch with JSON path extraction |
| `12875401142070969085` | Web Scraper | HTML page scraping with CSS selectors |

### Calling an Agent: inferToolsChat

The primary interface for LLM calls. Sends a chat-style message array and receives a text response via callback.

```solidity
function createRequest(
    uint256 agentId,
    bytes calldata data,          // ABI-encoded parameters
    address callbackContract,
    bytes4 callbackSelector,
    uint256 deposit               // STT payment for execution
) external returns (uint256 requestId);
```

**Selector:** `0xd0683905` (inferToolsChat)

**Encoding:**

```solidity
// Messages format: (string role, string content)[]
(string, string)[] memory messages = new (string, string)[](2);
messages[0] = ("system", "You are a prediction market creator...");
messages[1] = ("user", "Create a market about technology...");

bytes memory data = abi.encodeWithSelector(
    0xd0683905,  // inferToolsChat
    messages,
    ""           // tools (empty for basic inference)
);
```

**Deposit:** 0.33 STT per call (covers LLM compute costs).

### Callback Pattern

Agent responses arrive asynchronously via callback:

```solidity
function onBrainResult(
    uint256 requestId,
    bytes calldata response
) external onlyPlatform {
    string memory text = abi.decode(response, (string));
    // Parse and act on the LLM response
}
```

The `onlyPlatform` modifier ensures only the Agent Platform can deliver results:

```solidity
modifier onlyPlatform() {
    require(msg.sender == PLATFORM_ADDRESS, "Only platform");
    _;
}
```

## Market Creation Agent Flow

When ReactiveV2 triggers `createMarket(category)`, FinalV2 constructs a prompt and calls the LLM:

### System Prompt

```
You are an autonomous prediction market creator for Santiora protocol.
Generate a prediction market question based on the given category.

Rules:
- Question must be verifiable within 1-7 days
- Question must have a clear YES/NO outcome
- Set realistic odds (not 50/50 unless truly uncertain)
- Choose deadline based on event timing

Respond in JSON:
{
  "question": "Will [specific event] happen by [date]?",
  "odds": 65,
  "deadline": 1717200000,
  "category": "technology"
}
```

### User Prompt

```
Category: technology
Current timestamp: 1717100000
Create a trending prediction market.
```

### Expected Response

```json
{
  "question": "Will NVIDIA stock price exceed $1200 by June 5, 2025?",
  "odds": 62,
  "deadline": 1717545600,
  "category": "technology"
}
```

### Processing the Response

```solidity
function onBrainResult(uint256 requestId, bytes calldata response) external onlyPlatform {
    uint256 marketId = requestToMarket[requestId];
    Market storage m = markets[marketId];

    string memory text = abi.decode(response, (string));

    // Parse JSON response (simplified — actual uses string matching)
    // Extract: question, odds, deadline, category
    m.question = extractField(text, "question");
    m.odds = extractNumber(text, "odds");
    m.deadline = extractNumber(text, "deadline");
    m.status = MarketStatus.Active;

    // Register in MarketRegistry
    registry.registerMarket(marketId, m.question, m.odds, m.deadline, m.category);

    emit MarketCreated(marketId, m.question, m.odds, m.deadline);
}
```

## Resolution Agent Flow (Agent-to-Agent)

Resolution uses a 3-agent verification chain. This is the core agent-to-agent interaction that demonstrates multi-agent coordination.

### Step 1: JSON API Agent Fetches Data

```solidity
function _fetchDataForResolve(uint256 marketId) internal {
    Market storage m = markets[marketId];

    // Build API request based on market category
    string memory url = _buildDataUrl(m.category, m.question);
    string memory selector = "$.data";

    bytes memory data = abi.encodeWithSelector(
        FETCH_STRING_SELECTOR,
        url,
        selector
    );

    uint256 reqId = platform.createRequest(
        JSON_API_AGENT_ID,    // 13174292974160097713
        data,
        address(this),
        this.onDataFetched.selector,
        DEPOSIT
    );

    requestType[reqId] = 3;  // data fetch type
    requestToMarket[reqId] = marketId;
}
```

### Step 2: LLM Resolver Interprets Data

```solidity
function onDataFetched(uint256 requestId, bytes calldata response) external onlyPlatform {
    uint256 marketId = requestToMarket[requestId];
    Market storage m = markets[marketId];
    string memory fetchedData = abi.decode(response, (string));

    // Now ask LLM to interpret
    (string, string)[] memory messages = new (string, string)[](2);
    messages[0] = ("system", "You are a prediction market resolver. Based on the provided data, determine if the market outcome is YES or NO. Respond with JSON: {\"outcome\": \"YES\"|\"NO\", \"confidence\": 0-100, \"reasoning\": \"...\"}");
    messages[1] = ("user", string.concat(
        "Market question: ", m.question,
        "\nReal-world data: ", fetchedData,
        "\nDetermine the outcome."
    ));

    bytes memory data = abi.encodeWithSelector(0xd0683905, messages, "");

    uint256 reqId = platform.createRequest(
        LLM_AGENT_ID,
        data,
        address(this),
        this.onBrainResolveResult.selector,
        DEPOSIT
    );

    requestType[reqId] = 4;  // resolve type
    requestToMarket[reqId] = marketId;
}
```

### Step 3: LLM Verifier Cross-Checks

```solidity
function onBrainResolveResult(uint256 requestId, bytes calldata response) external onlyPlatform {
    uint256 marketId = requestToMarket[requestId];
    Market storage m = markets[marketId];
    string memory resolverResponse = abi.decode(response, (string));

    // Store resolver's answer
    m.resolverResponse = resolverResponse;

    // Now ask independent verifier
    (string, string)[] memory messages = new (string, string)[](2);
    messages[0] = ("system", "You are an independent verification agent. Cross-check the following resolution independently. Do NOT simply agree — verify from first principles. Respond with JSON: {\"outcome\": \"YES\"|\"NO\", \"confidence\": 0-100, \"reasoning\": \"...\"}");
    messages[1] = ("user", string.concat(
        "Market: ", m.question,
        "\nFirst agent determined: ", resolverResponse,
        "\nVerify this independently."
    ));

    bytes memory data = abi.encodeWithSelector(0xd0683905, messages, "");

    uint256 reqId = platform.createRequest(
        LLM_AGENT_ID,
        data,
        address(this),
        this.onVerifyResult.selector,
        DEPOSIT
    );

    requestType[reqId] = 5;  // verify type
    requestToMarket[reqId] = marketId;
}
```

### Step 4: Compare and Finalize

```solidity
function onVerifyResult(uint256 requestId, bytes calldata response) external onlyPlatform {
    uint256 marketId = requestToMarket[requestId];
    Market storage m = markets[marketId];
    string memory verifierResponse = abi.decode(response, (string));

    // Parse both outcomes
    string memory resolverOutcome = extractField(m.resolverResponse, "outcome");
    string memory verifierOutcome = extractField(verifierResponse, "outcome");

    // Compare
    bool match = keccak256(bytes(resolverOutcome)) == keccak256(bytes(verifierOutcome));
    uint256 finalConfidence = match ? 95 : 60;

    emit AgentToAgentVerification(marketId, resolverOutcome, verifierOutcome, match);

    if (finalConfidence >= rules.confidenceThreshold) {
        m.outcome = resolverOutcome;
        m.confidence = finalConfidence;
        m.status = MarketStatus.Resolved;
        m.resolutionData = string.concat(
            "resolver:", resolverOutcome,
            "|verifier:", verifierOutcome,
            "|confidence:", toString(finalConfidence)
        );
        emit MarketResolved(marketId, resolverOutcome, finalConfidence);
    } else {
        m.status = MarketStatus.Failed;
        emit ResolutionFailed(marketId, "verification_mismatch");
    }
}
```

## Agent-to-Agent Interaction Diagram

```
┌─────────────────┐         ┌─────────────────┐
│  ReactiveV2     │────────▶│  FinalV2        │
│  (Scheduler)    │  call   │  (Brain)        │
└─────────────────┘         └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │ JSON API     │ │ LLM Agent    │ │ LLM Agent    │
           │ Agent        │ │ (Resolver)   │ │ (Verifier)   │
           │              │ │              │ │              │
           │ Fetches data │ │ Interprets   │ │ Cross-checks │
           │ from web     │ │ outcome      │ │ independently│
           └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                  │                │                │
                  ▼                ▼                ▼
           ┌─────────────────────────────────────────────┐
           │              FinalV2 Callbacks               │
           │  onDataFetched → onBrainResolveResult →     │
           │  onVerifyResult → Compare → Resolve/Fail    │
           └─────────────────────────────────────────────┘
```

## Agent Costs

| Operation | Agents Called | Total Cost |
|-----------|-------------|------------|
| Create market | 1 LLM call | 0.33 STT |
| Resolve (simple) | 1 LLM call | 0.33 STT |
| Resolve (with verification) | 1 API + 2 LLM calls | 0.99 STT |
| Resolve (with data fetch) | 1 API + 1 LLM + 1 LLM | 0.99 STT |

### Daily Budget Planning

| Interval | Creates/Day | Resolves/Day | Agent Cost/Day |
|----------|-------------|--------------|----------------|
| 30 min | 48 | 48 (max) | ~16 STT creates + ~16 STT resolves |
| 1 hour | 24 | 48 (max) | ~8 STT creates + ~16 STT resolves |
| 2 hours | 12 | 48 (max) | ~4 STT creates + ~16 STT resolves |

Note: Resolve cost depends on how many markets are actually expired. If no markets are expired, the resolve fire costs only ReactiveV2 gas (~0.005 STT).

## On-Chain Verification

Every agent interaction is verifiable on the Somnia explorer:

1. **Request transaction:** Shows the encoded prompt sent to the agent
2. **Callback transaction:** Shows the agent's response delivered to the contract
3. **Events:** `Decision`, `BrainResponse`, `AgentToAgentVerification` log the full chain

Example explorer flow:
```
TX 1: ReactiveV2._onEvent() → FinalV2.createMarket("technology")
TX 2: FinalV2 → Platform.createRequest(LLM_AGENT, prompt, callback)
TX 3: Platform → FinalV2.onBrainResult(requestId, "{"question":"Will..."}")
```

All three transactions are linked by `requestId` and visible on-chain.

## Error Handling

### Agent Call Failures

If an agent call fails (timeout, invalid response), the request is consumed but no callback arrives. FinalV2 handles this with:

- **Retry counter:** Each market tracks retry attempts
- **Max retries:** Configurable per operation (default: 3)
- **Timeout detection:** If no callback within N blocks, mark as failed

### Malformed Responses

LLM responses may not always be valid JSON. FinalV2 uses defensive parsing:

```solidity
// If JSON parsing fails, mark market as failed rather than reverting
try this._parseAndRegister(marketId, text) {
    // Success
} catch {
    m.status = MarketStatus.Failed;
    emit MarketCreateFailed(marketId, "parse_error");
}
```

### Confidence Threshold

Markets only resolve if confidence meets the threshold (default: 80%). Below threshold:

- Agent mismatch (60% confidence) → market marked as Failed
- Single agent low confidence → retry with different prompt
- All retries exhausted → market expires unresolved, bets refunded
