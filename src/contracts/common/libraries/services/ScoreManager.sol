// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "./helpers/QuorumTracker.sol";
import "../../interfaces/IRegistry.sol";

library ScoreManager {
    function commitScoreHash(
        string memory did,
        bytes32 scoreHash,
        DataTypes.Request storage request,
        DataTypes.QuorumCommit storage scoreUpdates
    ) internal returns (bool) {
        if (request.status != DataTypes.RequestStatus.Completed &&
            request.status != DataTypes.RequestStatus.Failed
        ) {
            revert Errors.InvalidRequestStatus(request.status);
        }
        return QuorumTracker.commitHash(did, scoreUpdates, scoreHash, request.ko);
    }

    function updateScores(
        DataTypes.QuorumCommit storage scoreUpdates,
        address[] calldata idxAddrs,
        int256[] calldata idxScores,
        address[] calldata oraAddrs,
        int256[] calldata oraScores,
        IRegistry indexerRegistry,
        IRegistry oracleRegistry
    ) internal {
        bytes32 computedHash = keccak256(
            abi.encodePacked(idxAddrs, idxScores, oraAddrs, oraScores)
        );
        QuorumTracker.closeQuorum(computedHash, scoreUpdates);
        indexerRegistry.updateScores(idxAddrs, idxScores);
        oracleRegistry.updateScores(oraAddrs, oraScores);
    }
} 