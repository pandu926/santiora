// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ShareToken
/// @notice ERC20 token representing YES or NO shares in a prediction market
contract ShareToken is ERC20 {
    address public immutable market;

    modifier onlyMarket() {
        require(msg.sender == market, "Only market");
        _;
    }

    constructor(string memory name, string memory symbol, address _market) ERC20(name, symbol) {
        market = _market;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }
}
