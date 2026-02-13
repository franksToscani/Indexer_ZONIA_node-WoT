// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../types/DataTypes.sol";
import "../../types/Constants.sol";
import "../../types/Errors.sol";

library QuorumTracker {

    function commitHash(
        string memory did,
        DataTypes.QuorumCommit storage commit,
        bytes32 hash,
        uint256 total
    ) internal returns (bool) {
        if (commit.acceptedHash != bytes32(0)) {
            revert Errors.HashAlreadyLocked();
        }
        if (commit.voted[did]) {
            revert Errors.AlreadyVoted();
        }

        commit.voted[did] = true;
        commit.votes[hash]++;

        if (commit.votes[hash] * 3 >= total * 2) {
            commit.acceptedHash = hash;
            return true;
        }

        return false;
    }

    function closeQuorum(
        bytes32 computedHash,
        DataTypes.QuorumCommit storage commit
    ) internal returns (bool) {
        if (commit.acceptedHash == bytes32(0)) {
            revert Errors.HashNotLocked();
        }
        if (commit.closed) {
            revert Errors.QuorumClosed();
        }
        if (computedHash != commit.acceptedHash) {
            revert Errors.InvalidHash();
        }

        commit.closed = true;
        return true;
    }

    function commitVote(
        string memory did,
        uint256 total,
        DataTypes.QuorumVote storage quorum
    ) internal returns (bool) {
        if (quorum.voted[did]) {
            revert Errors.AlreadyVoted();
        }

        quorum.voted[did] = true;
        quorum.votes++;

        return (quorum.votes * 3 >= total * 2);
    }

}
