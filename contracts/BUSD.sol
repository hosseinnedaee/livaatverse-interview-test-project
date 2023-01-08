// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BUSD is ERC20 {
  constructor() ERC20("Binance USD", "BUSD") {
    _mint(msg.sender, 600_000_000 ether);
  }
}