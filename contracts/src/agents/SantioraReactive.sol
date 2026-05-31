// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import { ISomniaReactivityPrecompile } from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";
import { SomniaExtensions } from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import "../interfaces/IAgentPlatform.sol";

/// @title SantioraReactive — True autonomous reactivity for prediction markets
/// @notice Subscribes to on-chain events and auto-triggers resolution when deadlines pass
/// @dev Uses Somnia Native Reactivity (precompile 0x0100) — validator calls _onEvent automatically
contract SantioraReactive is SomniaEventHandler {

    ISomniaReactivityPrecompile private constant PRECOMPILE =
        ISomniaReactivityPrecompile(SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS);

    address public constant PLATFORM = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;
    uint256 public constant LLM_AGENT_ID = 12847293847561029384;
    uint256 public constant LLM_DEPOSIT = 24e16;

    address public owner;
    address public santioraFinal;

    uint256 public blockTickSubscriptionId;
    uint256 public marketActiveSubscriptionId;

    uint256 public totalBlockTicks;
    uint256 public totalAutoResolves;
    uint256 public lastTickBlock;

    struct PendingResolution {
        uint256 marketId;
        bool triggered;
        uint256 triggeredAt;
    }

    PendingResolution[] public pendingResolutions;
    mapping(uint256 => uint256) public requestToResolution;

    event BlockTickReceived(uint256 blockNumber, uint256 timestamp);
    event DeadlineExpired(uint256 indexed marketId, uint256 deadline, uint256 currentTime);
    event AutoResolutionTriggered(uint256 indexed marketId, uint256 requestId);
    event AutoResolutionComplete(uint256 indexed marketId, string outcome);
    event SubscriptionCreated(string subscriptionType, uint256 subscriptionId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyPlatform() {
        require(msg.sender == PLATFORM, "Only platform");
        _;
    }

    constructor(address _santioraFinal) {
        owner = msg.sender;
        santioraFinal = _santioraFinal;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // SUBSCRIPTION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /// @notice Subscribe to BlockTick — fires every block, checks deadlines
    function subscribeBlockTick(uint64 gasLimit) external onlyOwner {
        require(blockTickSubscriptionId == 0, "Already subscribed");

        // BlockTick event signature from ISomniaReactivityPrecompile
        bytes32 blockTickSig = keccak256("BlockTick(uint64)");

        ISomniaReactivityPrecompile.SubscriptionData memory subData =
            ISomniaReactivityPrecompile.SubscriptionData({
                eventTopics: [blockTickSig, bytes32(0), bytes32(0), bytes32(0)],
                origin: address(0),
                caller: address(0),
                emitter: SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS,
                handlerContractAddress: address(this),
                handlerFunctionSelector: this.onEvent.selector,
                priorityFeePerGas: 2_000_000_000,
                maxFeePerGas: 10_000_000_000,
                gasLimit: gasLimit,
                isGuaranteed: false,
                isCoalesced: true // coalesce multiple blocks into one call
            });

        blockTickSubscriptionId = PRECOMPILE.subscribe(subData);
        emit SubscriptionCreated("BlockTick", blockTickSubscriptionId);
    }

    /// @notice Subscribe to MarketActive events from SantioraFinal
    function subscribeMarketActive(uint64 gasLimit) external onlyOwner {
        require(marketActiveSubscriptionId == 0, "Already subscribed");

        // MarketActive(uint256 indexed marketId, string question, uint256 odds, uint256 deadline)
        bytes32 marketActiveSig = keccak256("MarketActive(uint256,string,uint256,uint256)");

        ISomniaReactivityPrecompile.SubscriptionData memory subData =
            ISomniaReactivityPrecompile.SubscriptionData({
                eventTopics: [marketActiveSig, bytes32(0), bytes32(0), bytes32(0)],
                origin: address(0),
                caller: address(0),
                emitter: santioraFinal,
                handlerContractAddress: address(this),
                handlerFunctionSelector: this.onEvent.selector,
                priorityFeePerGas: 2_000_000_000,
                maxFeePerGas: 10_000_000_000,
                gasLimit: gasLimit,
                isGuaranteed: true, // guaranteed delivery for market events
                isCoalesced: false
            });

        marketActiveSubscriptionId = PRECOMPILE.subscribe(subData);
        emit SubscriptionCreated("MarketActive", marketActiveSubscriptionId);
    }

    /// @notice Cancel BlockTick subscription
    function unsubscribeBlockTick() external onlyOwner {
        require(blockTickSubscriptionId != 0, "Not subscribed");
        PRECOMPILE.unsubscribe(blockTickSubscriptionId);
        blockTickSubscriptionId = 0;
    }

    /// @notice Cancel MarketActive subscription
    function unsubscribeMarketActive() external onlyOwner {
        require(marketActiveSubscriptionId != 0, "Not subscribed");
        PRECOMPILE.unsubscribe(marketActiveSubscriptionId);
        marketActiveSubscriptionId = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    // REACTIVE CALLBACK — Called automatically by Somnia validator
    // ═══════════════════════════════════════════════════════════════

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (eventTopics.length == 0) return;

        bytes32 eventSig = eventTopics[0];
        bytes32 blockTickSig = keccak256("BlockTick(uint64)");
        bytes32 marketActiveSig = keccak256("MarketActive(uint256,string,uint256,uint256)");

        if (eventSig == blockTickSig) {
            _handleBlockTick();
        } else if (eventSig == marketActiveSig) {
            _handleMarketActive(eventTopics, data);
        }
    }

    /// @dev Called every block (coalesced) — check if any market deadlines expired
    function _handleBlockTick() internal {
        totalBlockTicks++;
        lastTickBlock = block.number;
        emit BlockTickReceived(block.number, block.timestamp);

        // Check SantioraFinal for expired markets
        ISantioraFinal sf = ISantioraFinal(santioraFinal);
        uint256 count = sf.getMarketCount();

        for (uint256 i = 0; i < count; i++) {
            (,, uint256 deadline,, uint8 status,,,) = sf.getMarket(i);

            // Status 1 = Active, deadline passed
            if (status == 1 && block.timestamp >= deadline) {
                _triggerAutoResolve(i, sf);
            }
        }
    }

    /// @dev Called when a new market becomes Active — register for deadline tracking
    function _handleMarketActive(bytes32[] calldata eventTopics, bytes calldata) internal {
        if (eventTopics.length < 2) return;
        uint256 marketId = uint256(eventTopics[1]);
        emit DeadlineExpired(marketId, 0, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-RESOLUTION via LLM Agent
    // ═══════════════════════════════════════════════════════════════

    function _triggerAutoResolve(uint256 marketId, ISantioraFinal sf) internal {
        // Check if already triggered
        for (uint256 i = 0; i < pendingResolutions.length; i++) {
            if (pendingResolutions[i].marketId == marketId && pendingResolutions[i].triggered) return;
        }

        (string memory question,,,,,,, ) = sf.getMarket(marketId);

        string[] memory allowed = new string[](2);
        allowed[0] = "YES";
        allowed[1] = "NO";

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            string.concat("Has this event happened? \"", question, "\". Answer YES or NO based on known facts."),
            "You are a factual oracle. Answer only YES or NO.",
            true,
            allowed
        );

        uint256 reqId = IAgentRequester(PLATFORM).createRequest{value: LLM_DEPOSIT}(
            LLM_AGENT_ID,
            address(this),
            this.onAutoResolveResult.selector,
            payload
        );

        pendingResolutions.push(PendingResolution({
            marketId: marketId,
            triggered: true,
            triggeredAt: block.timestamp
        }));
        requestToResolution[reqId] = pendingResolutions.length - 1;

        totalAutoResolves++;
        emit AutoResolutionTriggered(marketId, reqId);
        emit DeadlineExpired(marketId, 0, block.timestamp);
    }

    function onAutoResolveResult(
        uint256 requestId, Response[] memory responses, ResponseStatus status, Request memory
    ) external onlyPlatform {
        uint256 resIdx = requestToResolution[requestId];
        PendingResolution storage res = pendingResolutions[resIdx];

        if (status == ResponseStatus.Success && responses.length > 0) {
            string memory outcome = abi.decode(responses[0].result, (string));
            emit AutoResolutionComplete(res.marketId, outcome);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════════

    function getStats() external view returns (
        uint256 ticks, uint256 autoResolves, uint256 lastBlock, uint256 pending
    ) {
        return (totalBlockTicks, totalAutoResolves, lastTickBlock, pendingResolutions.length);
    }

    function getSubscriptionInfo(uint256 subId) external view returns (
        ISomniaReactivityPrecompile.SubscriptionData memory subData, address subOwner
    ) {
        return PRECOMPILE.getSubscriptionInfo(subId);
    }
}

interface ISantioraFinal {
    function getMarket(uint256 id) external view returns (
        string memory question, uint256 odds, uint256 deadline, string memory category,
        uint8 status, string memory outcome, uint256 confidence, string memory resolutionData
    );
    function getMarketCount() external view returns (uint256);
}
