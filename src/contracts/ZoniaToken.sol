// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ZoniaToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Zonia Token", "ZT") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}