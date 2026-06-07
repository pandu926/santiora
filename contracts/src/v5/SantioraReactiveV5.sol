// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import { SomniaExtensions } from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";

interface ISantioraV5 {
    function createMarket(string calldata category) external;
    function resolveMarket(uint256 marketId) external;
    function marketCount() external view returns (uint256);
    function markets(uint256) external view returns (
        string memory question, uint256 odds, uint256 deadline, string memory category,
        uint8 status, string memory outcome, uint256 confidence, uint256 createdAt,
        string memory sourceUrl, string memory rawResponse
    );
    function getCategories() external view returns (string[] memory);
}

/// @title SantioraReactiveV5 - Autonomous trigger for V5 LLM orchestrator
/// @notice Schedules block-based triggers for market creation and resolution
contract SantioraReactiveV5 is SomniaEventHandler {

    address public owner;
    ISantioraV5 public v5;

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

    uint8 public categoryIndex;

    event CreateFired(uint256 blockNumber, string category);
    event CreateSkipped(uint256 blockNumber, string reason);
    event ResolveFired(uint256 blockNumber, uint256 marketsChecked, uint256 marketsResolved);
    event ScheduledNext(string jobType, uint64 targetBlock, uint256 subscriptionId);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _v5, uint64 _createInterval, uint64 _resolveInterval) {
        owner = msg.sender;
        v5 = ISantioraV5(_v5);
        createIntervalBlocks = _createInterval;
        resolveIntervalBlocks = _resolveInterval;
        gasLimitCreate = 200_000_000;
        gasLimitResolve = 200_000_000;
    }

    receive() external payable {}

    // ═══════════════════════════════════════════════════════════════
    // START / STOP
    // ═══════════════════════════════════════════════════════════════

    function startCreateLoop() external onlyOwner {
        require(createSubscriptionId == 0, "already running");
        uint64 target = uint64(block.number) + createIntervalBlocks;
        createSubscriptionId = _scheduleAt(target, gasLimitCreate);
        lastCreateBlock = block.number;
        emit ScheduledNext("create", target, createSubscriptionId);
    }

    function startResolveLoop() external onlyOwner {
        require(resolveSubscriptionId == 0, "already running");
        uint64 target = uint64(block.number) + resolveIntervalBlocks;
        resolveSubscriptionId = _scheduleAt(target, gasLimitResolve);
        lastResolveBlock = block.number;
        emit ScheduledNext("resolve", target, resolveSubscriptionId);
    }

    function stopCreateLoop() external onlyOwner {
        require(createSubscriptionId != 0, "not running");
        try this._tryUnsubscribe(createSubscriptionId) {} catch {}
        createSubscriptionId = 0;
    }

    function stopResolveLoop() external onlyOwner {
        require(resolveSubscriptionId != 0, "not running");
        try this._tryUnsubscribe(resolveSubscriptionId) {} catch {}
        resolveSubscriptionId = 0;
    }

    function _tryUnsubscribe(uint256 subId) external {
        require(msg.sender == address(this), "internal");
        SomniaExtensions.unsubscribe(subId);
    }

    function forceResetCreate() external onlyOwner { createSubscriptionId = 0; }
    function forceResetResolve() external onlyOwner { resolveSubscriptionId = 0; }

    // ═══════════════════════════════════════════════════════════════
    // REACTIVE HANDLER
    // ═══════════════════════════════════════════════════════════════

    function _onEvent(
        address,
        bytes32[] calldata,
        bytes calldata
    ) internal override {
        uint256 currentBlock = block.number;
        bool isCreateJob = (createSubscriptionId != 0 && currentBlock >= lastCreateBlock + createIntervalBlocks);
        bool isResolveJob = (resolveSubscriptionId != 0 && currentBlock >= lastResolveBlock + resolveIntervalBlocks);

        if (isCreateJob) {
            _handleCreate();
            createSubscriptionId = 0;
            uint64 target = uint64(block.number) + createIntervalBlocks;
            createSubscriptionId = _scheduleAt(target, gasLimitCreate);
            emit ScheduledNext("create", target, createSubscriptionId);
        }

        if (isResolveJob) {
            _handleResolve();
            resolveSubscriptionId = 0;
            uint64 target = uint64(block.number) + resolveIntervalBlocks;
            resolveSubscriptionId = _scheduleAt(target, gasLimitResolve);
            emit ScheduledNext("resolve", target, resolveSubscriptionId);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE LOGIC
    // ═══════════════════════════════════════════════════════════════

    function _handleCreate() internal {
        totalCreateFires++;
        lastCreateBlock = block.number;

        string[] memory cats = v5.getCategories();
        if (cats.length == 0) {
            emit CreateSkipped(block.number, "no categories");
            return;
        }

        string memory category = cats[categoryIndex % cats.length];
        categoryIndex = uint8((categoryIndex + 1) % cats.length);

        try v5.createMarket(category) {
            totalMarketsCreated++;
            emit CreateFired(block.number, category);
        } catch {
            emit CreateSkipped(block.number, "createMarket reverted");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESOLVE LOGIC
    // ═══════════════════════════════════════════════════════════════

    function _handleResolve() internal {
        totalResolveFires++;
        lastResolveBlock = block.number;

        uint256 count = v5.marketCount();
        uint256 checked;
        uint256 resolved;

        for (uint256 i = 0; i < count && checked < 10; i++) {
            (, , uint256 deadline, , uint8 status, , , , ,) = v5.markets(i);
            if (status == 1 && block.timestamp >= deadline) {
                checked++;
                try v5.resolveMarket(i) {
                    resolved++;
                    totalAutoResolves++;
                } catch {}
            }
        }

        emit ResolveFired(block.number, checked, resolved);
    }

    // ═══════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════

    function setIntervals(uint64 createInterval, uint64 resolveInterval) external onlyOwner {
        createIntervalBlocks = createInterval;
        resolveIntervalBlocks = resolveInterval;
    }

    function setGasLimits(uint64 create, uint64 resolve) external onlyOwner {
        gasLimitCreate = create;
        gasLimitResolve = resolve;
    }

    function setV5(address newV5) external onlyOwner {
        v5 = ISantioraV5(newV5);
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "withdraw failed");
    }

    // ═══════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════

    function getStats() external view returns (
        uint256 createFires, uint256 resolveFires,
        uint256 autoResolves, uint256 marketsCreated,
        uint256 lastCreate, uint256 lastResolve
    ) {
        return (totalCreateFires, totalResolveFires, totalAutoResolves, totalMarketsCreated, lastCreateBlock, lastResolveBlock);
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL
    // ═══════════════════════════════════════════════════════════════

    function _scheduleAt(uint64 targetBlock, uint64 gasLimit) internal returns (uint256) {
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: 2_000_000_000,
            maxFeePerGas: 10_000_000_000,
            gasLimit: gasLimit
        });
        return SomniaExtensions.scheduleSubscriptionAtBlock(address(this), targetBlock, opts);
    }
}
