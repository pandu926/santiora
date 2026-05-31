// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import { SomniaExtensions } from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";

interface ISantioraFinalV2 {
    function createMarket(string calldata category) external payable returns (uint256);
    function autoResolveExpired(uint256 marketId) external;
    function getMarket(uint256 id) external view returns (
        string memory question, uint256 odds, uint256 deadline, string memory category,
        uint8 status, string memory outcome, uint256 confidence, string memory resolutionData
    );
    function getMarketCount() external view returns (uint256);
    function getNextCategory() external view returns (string memory);
    function canCreateMarket() external view returns (bool allowed, string memory reason);
}

/// @title SantioraReactiveV2 - Gas-efficient autonomous orchestrator
/// @notice Uses scheduleSubscriptionAtBlock for one-shot triggers instead of BlockTick polling
/// @dev Only pays gas when actual work fires (~72 tx/day vs 216K with BlockTick)
contract SantioraReactiveV2 is SomniaEventHandler {

    address public owner;
    ISantioraFinalV2 public finalV2;

    uint64 public createIntervalBlocks;
    uint64 public resolveIntervalBlocks;
    uint64 public gasLimitCreate;
    uint64 public gasLimitResolve;

    uint256 public totalCreateFires;
    uint256 public totalResolveFires;
    uint256 public totalMarketsCreated;
    uint256 public totalAutoResolves;
    uint256 public lastCreateBlock;
    uint256 public lastResolveBlock;

    uint256 public createSubscriptionId;
    uint256 public resolveSubscriptionId;

    mapping(uint256 => bool) public resolveTriggered;

    event CreateFired(uint256 blockNumber, uint256 timestamp, string category);
    event CreateSkipped(uint256 blockNumber, string reason);
    event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
    event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _finalV2, uint64 _createInterval, uint64 _resolveInterval) {
        owner = msg.sender;
        finalV2 = ISantioraFinalV2(_finalV2);
        createIntervalBlocks = _createInterval;
        resolveIntervalBlocks = _resolveInterval;
        gasLimitCreate = 20_000_000;
        gasLimitResolve = 10_000_000;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // START - Kick off the scheduling loops
    // ═══════════════════════════════════════════════════════════════

    function startCreateLoop() external onlyOwner {
        require(createSubscriptionId == 0, "Already running");
        uint64 target = uint64(block.number) + createIntervalBlocks;
        createSubscriptionId = _scheduleAt(target, gasLimitCreate);
        lastCreateBlock = block.number;
        emit ScheduledNext("create", target, createSubscriptionId);
    }

    function startResolveLoop() external onlyOwner {
        require(resolveSubscriptionId == 0, "Already running");
        uint64 target = uint64(block.number) + resolveIntervalBlocks;
        resolveSubscriptionId = _scheduleAt(target, gasLimitResolve);
        lastResolveBlock = block.number;
        emit ScheduledNext("resolve", target, resolveSubscriptionId);
    }

    function stopCreateLoop() external onlyOwner {
        if (createSubscriptionId != 0) {
            SomniaExtensions.unsubscribe(createSubscriptionId);
            createSubscriptionId = 0;
        }
    }

    function stopResolveLoop() external onlyOwner {
        if (resolveSubscriptionId != 0) {
            SomniaExtensions.unsubscribe(resolveSubscriptionId);
            resolveSubscriptionId = 0;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // REACTIVE CALLBACK - Fired by validator at scheduled block
    // ═══════════════════════════════════════════════════════════════

    function _onEvent(
        address,
        bytes32[] calldata,
        bytes calldata
    ) internal override {
        // Determine which job fired based on timing
        uint256 currentBlock = block.number;
        bool isCreateJob = false;
        bool isResolveJob = false;

        if (createSubscriptionId != 0 && currentBlock >= lastCreateBlock + createIntervalBlocks) {
            isCreateJob = true;
        }
        if (resolveSubscriptionId != 0 && currentBlock >= lastResolveBlock + resolveIntervalBlocks) {
            isResolveJob = true;
        }

        // If neither matches (shouldn't happen), try both
        if (!isCreateJob && !isResolveJob) {
            isCreateJob = true;
            isResolveJob = true;
        }

        if (isCreateJob) {
            _handleCreate();
            // Schedule next create
            createSubscriptionId = 0;
            uint64 nextTarget = uint64(currentBlock) + createIntervalBlocks;
            createSubscriptionId = _scheduleAt(nextTarget, gasLimitCreate);
            lastCreateBlock = currentBlock;
            emit ScheduledNext("create", nextTarget, createSubscriptionId);
        }

        if (isResolveJob) {
            _handleResolve();
            // Schedule next resolve
            resolveSubscriptionId = 0;
            uint64 nextTarget = uint64(currentBlock) + resolveIntervalBlocks;
            resolveSubscriptionId = _scheduleAt(nextTarget, gasLimitResolve);
            lastResolveBlock = currentBlock;
            emit ScheduledNext("resolve", nextTarget, resolveSubscriptionId);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE - Trigger market creation via FinalV2
    // ═══════════════════════════════════════════════════════════════

    function _handleCreate() internal {
        totalCreateFires++;

        (bool allowed, string memory reason) = finalV2.canCreateMarket();
        if (!allowed) {
            emit CreateSkipped(block.number, reason);
            return;
        }

        string memory category = finalV2.getNextCategory();

        try finalV2.createMarket(category) {
            totalMarketsCreated++;
            emit CreateFired(block.number, block.timestamp, category);
        } catch {
            emit CreateSkipped(block.number, "createMarket_reverted");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE - Check and auto-resolve expired markets
    // ═══════════════════════════════════════════════════════════════

    function _handleResolve() internal {
        totalResolveFires++;
        uint256 count = finalV2.getMarketCount();
        uint256 resolved = 0;

        for (uint256 i = 0; i < count; i++) {
            if (resolveTriggered[i]) continue;

            (,, uint256 deadline,, uint8 status,,,) = finalV2.getMarket(i);

            // Status 1 = Active, deadline passed
            if (status == 1 && block.timestamp >= deadline) {
                resolveTriggered[i] = true;

                try finalV2.autoResolveExpired(i) {
                    resolved++;
                    totalAutoResolves++;
                } catch {}
            }
        }

        emit ResolveFired(block.number, count, resolved);
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL - Schedule a one-shot block trigger
    // ═══════════════════════════════════════════════════════════════

    function _scheduleAt(uint64 targetBlock, uint64 gasLimit) internal returns (uint256) {
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 2_000_000_000,
            maxFeePerGas: 10_000_000_000,
            gasLimit: gasLimit
        });

        return SomniaExtensions.scheduleSubscriptionAtBlock(
            address(this),
            targetBlock,
            opts
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════

    function setFinalV2(address _finalV2) external onlyOwner {
        finalV2 = ISantioraFinalV2(_finalV2);
    }

    function setCreateInterval(uint64 _blocks) external onlyOwner {
        createIntervalBlocks = _blocks;
    }

    function setResolveInterval(uint64 _blocks) external onlyOwner {
        resolveIntervalBlocks = _blocks;
    }

    function setGasLimits(uint64 _create, uint64 _resolve) external onlyOwner {
        gasLimitCreate = _create;
        gasLimitResolve = _resolve;
    }

    function withdraw(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    function withdrawAll() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEW
    // ═══════════════════════════════════════════════════════════════

    function getStats() external view returns (
        uint256 createFires, uint256 resolveFires, uint256 autoResolves,
        uint256 marketsCreated, uint256 lastCreate, uint256 lastResolve
    ) {
        return (totalCreateFires, totalResolveFires, totalAutoResolves, totalMarketsCreated, lastCreateBlock, lastResolveBlock);
    }

    function getGasEstimate() external view returns (
        uint256 firesPerDay, uint256 estimatedGasPerDay, string memory efficiency
    ) {
        // Create: every createIntervalBlocks, Resolve: every resolveIntervalBlocks
        // At 400ms/block: blocks per day = 216000
        uint256 createPerDay = createIntervalBlocks > 0 ? 216000 / uint256(createIntervalBlocks) : 0;
        uint256 resolvePerDay = resolveIntervalBlocks > 0 ? 216000 / uint256(resolveIntervalBlocks) : 0;
        firesPerDay = createPerDay + resolvePerDay;
        // Rough estimate: each fire costs ~0.002 STT average
        estimatedGasPerDay = firesPerDay * 2; // in milliSTT
        efficiency = "scheduleSubscriptionAtBlock: one-shot triggers, zero idle gas";
    }
}
