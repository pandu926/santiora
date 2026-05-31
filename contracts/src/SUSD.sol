// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SUSD — Santiora USD
/// @notice Unlimited supply testnet token for prediction market betting and liquidity
contract SUSD is ERC20 {
    address public owner;
    mapping(address => bool) public minters;

    constructor() ERC20("Santiora USD", "SUSD") {
        owner = msg.sender;
        minters[msg.sender] = true;
    }

    function addMinter(address _minter) external {
        require(msg.sender == owner, "Only owner");
        minters[_minter] = true;
    }

    function removeMinter(address _minter) external {
        require(msg.sender == owner, "Only owner");
        minters[_minter] = false;
    }

    function mint(address to, uint256 amount) external {
        require(minters[msg.sender], "Not a minter");
        _mint(to, amount);
    }
}
