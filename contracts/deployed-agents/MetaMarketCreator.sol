// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "../interfaces/IAgentPlatform.sol";
import "../PredictionMarketSUSD.sol";
import "../MarketFactoryLite.sol";

/// @title MetaMarketCreator
/// @notice Creates meta-markets — markets ABOUT other markets and AI performance
/// @dev "Will AutoAugur AI correctly resolve Market #5?" — AI accuracy becomes tradeable
contract MetaMarketCreator {
    address public constant PLATFORM_ADDRESS = 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    MarketFactoryLite public immutable factory;

    enum MetaType { AIAccuracy, MarketVolume, ResolutionSpeed, AgentPnL }

    struct MetaMarket {
        address targetMarket;
        MetaType metaType;
        address metaMarketAddress;
        bool resolved;
        uint256 threshold; // used for volume/pnl markets
    }

    MetaMarket[] public metaMarkets;

    event MetaMarketCreated(
        address indexed targetMarket,
        address indexed metaMarketAddress,
        MetaType metaType,
        uint256 metaIndex
    );
    event MetaMarketResolved(uint256 indexed metaIndex, bool aiWasCorrect);
    event MetaMarketVolumeResolved(uint256 indexed metaIndex, bool thresholdExceeded);
    event MetaMarketPnLResolved(uint256 indexed metaIndex, bool thresholdExceeded);

    modifier onlyPlatform() {
        require(
            msg.sender == PLATFORM_ADDRESS,
            "Only Agent Platform"
        );
        _;
    }

    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = MarketFactoryLite(payable(_factory));
    }

    /// @notice Create a meta-market about AI accuracy on a target market
    /// @dev "Will AI correctly resolve market at {targetMarket}?"
    /// @param targetMarket The market whose resolution accuracy is being bet on
    /// @return metaMarketAddress Address of the newly created meta-market
    function createAccuracyMarket(address targetMarket) external payable returns (address metaMarketAddress) {
        require(targetMarket != address(0), "Invalid target");

        PredictionMarketSUSD target = PredictionMarketSUSD(payable(targetMarket));
        uint256 targetDeadline = target.deadline();

        // Meta-market deadline = target deadline + 1 day (needs time to verify)
        uint256 metaDeadline = targetDeadline + 1 days;

        // Build resolution sources
        string[] memory sources = new string[](1);
        sources[0] = "onchain:market-resolution-verification";

        // Create market via factory (requires platform authorization)
        // For hackathon: emit event for platform callback pattern
        // The actual creation happens when this contract is authorized on the factory
        string memory question = string.concat(
            "Will AI correctly resolve market at ",
            _addressToString(targetMarket),
            "?"
        );

        metaMarketAddress = _createMarketViaFactory(
            question,
            metaDeadline,
            sources,
            bytes32("meta")
        );

        metaMarkets.push(MetaMarket({
            targetMarket: targetMarket,
            metaType: MetaType.AIAccuracy,
            metaMarketAddress: metaMarketAddress,
            resolved: false,
            threshold: 0
        }));

        emit MetaMarketCreated(
            targetMarket,
            metaMarketAddress,
            MetaType.AIAccuracy,
            metaMarkets.length - 1
        );
    }

    /// @notice Create a meta-market about volume threshold
    /// @dev "Will market {targetMarket} exceed {threshold} STT in volume?"
    /// @param targetMarket The market whose volume is being bet on
    /// @param threshold Volume threshold in wei
    /// @return metaMarketAddress Address of the newly created meta-market
    function createVolumeMarket(
        address targetMarket,
        uint256 threshold
    ) external payable returns (address metaMarketAddress) {
        require(targetMarket != address(0), "Invalid target");
        require(threshold > 0, "Zero threshold");

        PredictionMarketSUSD target = PredictionMarketSUSD(payable(targetMarket));
        uint256 targetDeadline = target.deadline();

        string[] memory sources = new string[](1);
        sources[0] = "onchain:market-volume-tracking";

        string memory question = string.concat(
            "Will market at ",
            _addressToString(targetMarket),
            " exceed volume threshold?"
        );

        metaMarketAddress = _createMarketViaFactory(
            question,
            targetDeadline,
            sources,
            bytes32("meta")
        );

        metaMarkets.push(MetaMarket({
            targetMarket: targetMarket,
            metaType: MetaType.MarketVolume,
            metaMarketAddress: metaMarketAddress,
            resolved: false,
            threshold: threshold
        }));

        emit MetaMarketCreated(
            targetMarket,
            metaMarketAddress,
            MetaType.MarketVolume,
            metaMarkets.length - 1
        );
    }

    /// @notice Create a meta-market about AI agent P&L performance
    /// @dev "Will AI agent net P&L exceed {pnlThreshold} STT by {deadline}?"
    /// @param pnlThreshold P&L threshold (can be negative)
    /// @param deadline Deadline for the meta-market
    /// @return metaMarketAddress Address of the newly created meta-market
    function createAgentPnLMarket(
        int256 pnlThreshold,
        uint256 deadline
    ) external payable returns (address metaMarketAddress) {
        require(deadline > block.timestamp, "Deadline must be future");

        string[] memory sources = new string[](1);
        sources[0] = "onchain:agent-pnl-tracking";

        string memory question = "Will AI agent net PnL exceed threshold by deadline?";

        metaMarketAddress = _createMarketViaFactory(
            question,
            deadline,
            sources,
            bytes32("meta")
        );

        // Store threshold as uint (cast safely for storage)
        metaMarkets.push(MetaMarket({
            targetMarket: address(0), // No specific target market
            metaType: MetaType.AgentPnL,
            metaMarketAddress: metaMarketAddress,
            resolved: false,
            threshold: uint256(pnlThreshold >= 0 ? pnlThreshold : -pnlThreshold)
        }));

        emit MetaMarketCreated(
            address(0),
            metaMarketAddress,
            MetaType.AgentPnL,
            metaMarkets.length - 1
        );
    }

    /// @notice Resolve an accuracy meta-market after target market is resolved
    /// @param metaIndex Index in the metaMarkets array
    function resolveAccuracyMarket(uint256 metaIndex) external {
        require(metaIndex < metaMarkets.length, "Invalid index");

        MetaMarket storage meta = metaMarkets[metaIndex];
        require(!meta.resolved, "Already resolved");
        require(meta.metaType == MetaType.AIAccuracy, "Not accuracy type");

        PredictionMarketSUSD target = PredictionMarketSUSD(payable(meta.targetMarket));
        PredictionMarketSUSD.MarketStatus targetStatus = target.status();
        require(
            targetStatus == PredictionMarketSUSD.MarketStatus.Resolved ||
            targetStatus == PredictionMarketSUSD.MarketStatus.Settled,
            "Target not resolved"
        );

        // Check resolution confidence as proxy for correctness
        // High confidence (>=80) means AI was likely correct
        uint256 confidence = target.resolutionConfidence();
        bool aiWasCorrect = confidence >= 80;

        meta.resolved = true;

        // Resolve the meta-market
        PredictionMarketSUSD metaMarket = PredictionMarketSUSD(payable(meta.metaMarketAddress));
        metaMarket.resolve(aiWasCorrect, confidence, "Auto-resolved based on target market outcome");

        emit MetaMarketResolved(metaIndex, aiWasCorrect);
    }

    /// @notice Get total number of meta-markets
    function getMetaMarketCount() external view returns (uint256) {
        return metaMarkets.length;
    }

    /// @notice Get meta-markets for a specific target market
    /// @param targetMarket Address of the target market
    /// @return indices Array of meta-market indices for this target
    function getMetaMarketsForTarget(address targetMarket) external view returns (uint256[] memory indices) {
        uint256 count = 0;
        for (uint256 i = 0; i < metaMarkets.length; i++) {
            if (metaMarkets[i].targetMarket == targetMarket) {
                count++;
            }
        }

        indices = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < metaMarkets.length; i++) {
            if (metaMarkets[i].targetMarket == targetMarket) {
                indices[idx] = i;
                idx++;
            }
        }
    }

    /// @dev Create a market via the factory — requires this contract to be authorized
    ///      For hackathon: uses direct factory call (contract must be platform-authorized)
    function _createMarketViaFactory(
        string memory question,
        uint256 deadline,
        string[] memory sources,
        bytes32 category
    ) internal returns (address) {
        // Convert memory arrays to calldata-compatible format
        // Factory requires onlyPlatform — in production this would go through
        // the agent platform callback. For hackathon, we call directly assuming
        // this contract address is whitelisted or the call is relayed by platform.
        (bool success, bytes memory data) = address(factory).call{value: msg.value}(
            abi.encodeWithSelector(
                MarketFactoryLite.createMarket.selector,
                question,
                deadline,
                sources,
                category,
                uint256(100) // 1% fee
            )
        );
        require(success, "Factory market creation failed");
        return abi.decode(data, (address));
    }

    /// @dev Convert address to string for market question generation
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    receive() external payable {}
}
