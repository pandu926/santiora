// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISUSD {
    function mint(address to, uint256 amount) external;
}

/// @title SantioraFaucet — Claim 0.1 STT + 1000 SUSD per address
/// @notice One claim per 24 hours. Fund contract with STT for gas distribution.
contract SantioraFaucet {
    ISUSD public immutable susd;

    uint256 public constant STT_AMOUNT = 0.1 ether;
    uint256 public constant SUSD_AMOUNT = 1000 ether;
    uint256 public constant COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaim;

    event Claimed(address indexed user, uint256 stt, uint256 susd);

    constructor(address _susd) {
        susd = ISUSD(_susd);
    }

    function claim() external {
        require(block.timestamp >= lastClaim[msg.sender] + COOLDOWN, "Wait 24h between claims");
        require(address(this).balance >= STT_AMOUNT, "Faucet empty");

        lastClaim[msg.sender] = block.timestamp;

        susd.mint(msg.sender, SUSD_AMOUNT);

        (bool ok,) = msg.sender.call{value: STT_AMOUNT}("");
        require(ok, "STT transfer failed");

        emit Claimed(msg.sender, STT_AMOUNT, SUSD_AMOUNT);
    }

    function canClaim(address user) external view returns (bool) {
        return block.timestamp >= lastClaim[user] + COOLDOWN;
    }

    receive() external payable {}
}
