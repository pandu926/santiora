// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";
import "../MarketFactoryLite.sol";
import "../PredictionMarketSUSD.sol";

/// @title ReactiveResolver — Chain-native auto-trigger resolution at market deadline
/// @dev Uses Somnia Reactive precompile (0x0100) to subscribe to block events.
///      When a block is produced, checks if any market deadline has passed and
///      triggers the resolution pipeline automatically. No backend cron needed.
contract ReactiveResolver {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    address public constant REACTIVE_PRECOMPILE = 0x0000000000000000000000000000000000000100;
    uint256 public constant WEB_SCRAPER_AGENT_ID = 12875401142070969085;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;

    MarketFactoryLite public immutable factory;

    uint256 public subscriptionId;
    bool public isActive;

    // Markets pending resolution (deadline passed, not yet resolved)
    address[] public pendingMarkets;
    mapping(address => bool) public isPending;
    mapping(address => uint256) public resolutionRequestIds;

    event SubscriptionCreated(uint256 subscriptionId);
    event DeadlineDetected(address indexed market, uint256 deadline, uint256 blockTimestamp);
    event ResolutionTriggered(address indexed market, uint256 requestId);
    event ResolutionCompleted(address indexed market, bool outcome, uint256 confidence);

    constructor(address _factory) {
        factory = MarketFactoryLite(payable(_factory));
    }

    receive() external payable {}

    /// @notice Subscribe to new blocks via Somnia Reactive precompile
    /// @dev This makes the contract automatically called on every new block
    function activate() external payable {
        require(!isActive, "Already active");

        // Subscribe to block events — handler called on each new block
        // Using the factory's MarketCreated event signature as trigger
        bytes32 blockEventSig = keccak256("BlockProduced(uint256,uint256)");

        subscriptionId = ISomniaReactive(REACTIVE_PRECOMPILE).subscribe(
            address(0), // any emitter (block-level)
            blockEventSig,
            address(this),
            this.onBlock.selector
        );

        isActive = true;
        emit SubscriptionCreated(subscriptionId);
    }

    /// @notice Deactivate reactive subscription
    function deactivate() external {
        require(isActive, "Not active");
        ISomniaReactive(REACTIVE_PRECOMPILE).unsubscribe(subscriptionId);
        isActive = false;
    }

    /// @notice Called reactively on each new block — check for expired markets
    /// @dev This is the reactive callback — chain calls this automatically
    function onBlock() external {
        uint256 marketCount = factory.getMarketCount();

        for (uint256 i = 0; i < marketCount; i++) {
            address marketAddr = factory.markets(i);
            if (isPending[marketAddr]) continue;

            PredictionMarketSUSD market = PredictionMarketSUSD(payable(marketAddr));
            PredictionMarketSUSD.MarketStatus status = market.status();

            // Only trigger for Active markets past deadline
            if (status != PredictionMarketSUSD.MarketStatus.Active) continue;
            if (block.timestamp < market.deadline()) continue;

            // Deadline passed — trigger resolution
            isPending[marketAddr] = true;
            pendingMarkets.push(marketAddr);

            emit DeadlineDetected(marketAddr, market.deadline(), block.timestamp);

            _triggerResolution(marketAddr);
        }
    }

    /// @notice Trigger AI resolution pipeline for a market
    function _triggerResolution(address marketAddr) internal {
        PredictionMarketSUSD market = PredictionMarketSUSD(payable(marketAddr));
        string memory question = market.question();

        // Step 1: Scrape sources for evidence
        string memory prompt = string.concat(
            "Find the factual outcome for this prediction market question: '",
            question,
            "'. Return YES if the event happened, NO if it did not. Include source URLs."
        );

        string[] memory options = new string[](2);
        options[0] = "YES";
        options[1] = "NO";

        bytes memory payload = abi.encodeWithSelector(
            IWebScraperAgent.ExtractString.selector,
            "outcome",
            "The factual outcome of the prediction",
            options,
            prompt,
            "https://www.google.com/search",
            true,
            uint8(3),
            uint8(70)
        );

        uint256 deposit = IAgentRequester(PLATFORM_ADDRESS).getRequestDeposit();
        uint256 requestId = IAgentRequester(PLATFORM_ADDRESS).createRequest{value: deposit}(
            WEB_SCRAPER_AGENT_ID,
            address(this),
            this.handleResolutionResponse.selector,
            payload
        );

        resolutionRequestIds[marketAddr] = requestId;
        emit ResolutionTriggered(marketAddr, requestId);
    }

    /// @notice Handle resolution response from AI agent
    function handleResolutionResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        require(msg.sender == PLATFORM_ADDRESS, "Only platform");

        address marketAddr = _findMarketByRequest(requestId);
        require(marketAddr != address(0), "Market not found");

        if (status != ResponseStatus.Success || responses.length == 0) {
            // Failed — remove from pending, can retry next block
            isPending[marketAddr] = false;
            return;
        }

        // Decode response — determine outcome and confidence
        string memory result = abi.decode(responses[0].result, (string));
        bool outcome = keccak256(bytes(result)) == keccak256("YES");

        // Use deterministic consensus: if SUBCOMMITTEE_SIZE > 1,
        // multiple validators must agree (handled by platform)
        uint256 agreementCount = 0;
        for (uint256 i = 0; i < responses.length; i++) {
            if (responses[i].status == ResponseStatus.Success) {
                string memory r = abi.decode(responses[i].result, (string));
                if (keccak256(bytes(r)) == keccak256(bytes(result))) {
                    agreementCount++;
                }
            }
        }

        uint256 confidence = (agreementCount * 100) / responses.length;

        // Only resolve if confidence >= 80%
        PredictionMarketSUSD market = PredictionMarketSUSD(payable(marketAddr));
        if (confidence >= 80) {
            market.resolve(outcome, confidence, string.concat("Reactive resolution: ", result));
            emit ResolutionCompleted(marketAddr, outcome, confidence);
        }

        // Remove from pending regardless
        isPending[marketAddr] = false;
    }

    function _findMarketByRequest(uint256 requestId) internal view returns (address) {
        for (uint256 i = 0; i < pendingMarkets.length; i++) {
            if (resolutionRequestIds[pendingMarkets[i]] == requestId) {
                return pendingMarkets[i];
            }
        }
        return address(0);
    }

    function getPendingCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < pendingMarkets.length; i++) {
            if (isPending[pendingMarkets[i]]) count++;
        }
        return count;
    }
}
