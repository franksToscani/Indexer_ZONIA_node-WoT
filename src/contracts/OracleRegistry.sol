// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "./common/interfaces/IZoniaToken.sol";
import "./common/libraries/types/Constants.sol";
import "./common/libraries/types/Events.sol";

import "./Registry.sol";

contract OracleRegistry is Registry {
    constructor(address gateAddress, address zoniaTokenAddress) Registry(gateAddress, zoniaTokenAddress) {
        _stakeAmount = Constants.DEFAULT_ORACLE_REQUIRED_STAKE;
    }

    function register(string memory did) public override {
        super.register(did);
        emit Events.OracleRegistered(did, msg.sender);
    }

    function deregister() public override {
        string memory did = _addresses[msg.sender];
        super.deregister();
        emit Events.OracleDeregistered(did, msg.sender);
    }
}