// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../libraries/types/Errors.sol";

abstract contract GateControllable {
    address public immutable GATE;

    modifier onlyGate() {
        if (msg.sender != GATE) revert Errors.NotGate();
        _;
    }

    constructor(address gate) {
        if (gate == address(0)) revert Errors.InvalidGateAddress();
        GATE = gate;
    }
}