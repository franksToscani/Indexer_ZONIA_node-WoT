// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";
import "../../interfaces/IRegistry.sol";
import "./helpers/QuorumTracker.sol";

library CommitteeManager {
    function submitCommitteeHash(
        string memory did,
        bytes32 committeeHash,
        DataTypes.RequestInfo storage info,
        IRegistry oracleRegistry
    ) internal returns (bool) {
        if (bytes(info.inputSeed.seed).length == 0) {
            revert Errors.SeedNotSubmitted();
        }
        uint256 totalOracles = oracleRegistry.total();
        // Returns true if the committee hash was successfully locked (count > 2/3 of ko)
        return QuorumTracker.commitHash(did, info.committeeSelection[info.inputSeed.submissions], committeeHash, totalOracles);
    }

    function submitCommittee(
        address[] calldata committee,
        DataTypes.Request storage request,
        DataTypes.RequestInfo storage info,
        IRegistry oracleRegistry
    ) internal returns (DataTypes.Node[] memory) {
        if (request.committee.length != 0) {
            revert Errors.CommitteeAlreadySelected();
        }
        if (committee.length != request.ko) {
            revert Errors.InvalidOraclesLength();
        }

        bytes32 computedHash = keccak256(abi.encodePacked(committee));
        QuorumTracker.closeQuorum(computedHash, info.committeeSelection[info.inputSeed.submissions]);

        DataTypes.Node[] memory nodes = oracleRegistry.getNodes(committee);

        uint256 ko = request.ko;
        for (uint256 i = 0; i < ko; i++) {
            request.committee.push(nodes[i]);
            info.isCommittee[nodes[i].did] = true;
        }

        return nodes;
    }
} 