// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";
import "./helpers/QuorumTracker.sol";

library IndexerRegistration {
    function applyToRequest(
        string memory did,
        DataTypes.Request storage request,
        DataTypes.RequestInfo storage info
    ) internal returns (DataTypes.Node memory) {
        if (info.isIndexer[did])
            revert Errors.IndexerAlreadyRegistered();

        info.isIndexer[did] = true;
        DataTypes.Node memory node = DataTypes.Node(did, msg.sender);

        request.indexers.push(node);
        return node;
    }

    function closeRegistration(
        string memory did,
        DataTypes.Request storage request,
        DataTypes.QuorumVote storage quorum
    ) internal returns (bool closed) {
        return QuorumTracker.commitVote(
            did,
            request.ko,
            quorum
        );
    }
}
