// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract SourceRegistry {
    struct SourceInfo {
        bytes32 urlHash;
        uint256 totalAttempts;
        uint256 successes;
        uint256 reliabilityScore;
        uint256 lastUsedAt;
    }

    address public owner;
    mapping(bytes32 => SourceInfo) public sources;
    bytes32[] public sourceHashes;

    event SourceUpdated(bytes32 indexed urlHash, uint256 attempts, uint256 successes, uint256 reliability);
    event SourceAdded(bytes32 indexed urlHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "!owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordAttempt(string calldata url, bool success) external onlyOwner {
        bytes32 h = keccak256(bytes(url));
        SourceInfo storage s = sources[h];

        if (s.totalAttempts == 0) {
            s.urlHash = h;
            sourceHashes.push(h);
            emit SourceAdded(h);
        }

        s.totalAttempts++;
        if (success) s.successes++;
        s.reliabilityScore = (s.successes * 100) / s.totalAttempts;
        s.lastUsedAt = block.timestamp;

        emit SourceUpdated(h, s.totalAttempts, s.successes, s.reliabilityScore);
    }

    function getReliability(string calldata url) external view returns (uint256) {
        bytes32 h = keccak256(bytes(url));
        SourceInfo storage s = sources[h];
        if (s.totalAttempts == 0) return 50;
        return s.reliabilityScore;
    }

    function getSourceInfo(string calldata url) external view returns (
        uint256 totalAttempts, uint256 successes, uint256 reliabilityScore, uint256 lastUsedAt
    ) {
        bytes32 h = keccak256(bytes(url));
        SourceInfo storage s = sources[h];
        return (s.totalAttempts, s.successes, s.reliabilityScore, s.lastUsedAt);
    }

    function getSourceCount() external view returns (uint256) {
        return sourceHashes.length;
    }

    receive() external payable {}
}
