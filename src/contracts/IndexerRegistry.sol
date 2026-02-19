// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "./common/interfaces/IZoniaToken.sol";
import "./common/libraries/types/Constants.sol";
import "./common/libraries/types/Events.sol";

import "./Registry.sol";

contract IndexerRegistry is Registry {
    constructor(address gateAddress, address zoniaTokenAddress) Registry(gateAddress, zoniaTokenAddress) {
        _stakeAmount = Constants.DEFAULT_INDEXER_REQUIRED_STAKE;
    }

    function register(string memory did) public override {
        super.register(did);
        emit Events.IndexerRegistered(did, msg.sender);
    }

    function deregister() public override {
        string memory did = _addresses[msg.sender];
        super.deregister();
        emit Events.IndexerDeregistered(did, msg.sender);
    }
}