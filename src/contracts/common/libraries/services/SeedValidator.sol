// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";
import "../types/Constants.sol";

library SeedValidator {
    function invalidateSeed(
        string memory did,
        DataTypes.InputSeed storage inputSeed,
        uint256 totalOracles
    ) internal returns (bool, bool) {
        if (bytes(inputSeed.seed).length == 0) {
            revert Errors.SeedNotSubmitted();
        }

        DataTypes.QuorumVote storage quorum = inputSeed.invalidationQuorum[inputSeed.submissions];
        if (quorum.voted[did]) {
            revert Errors.AlreadyVoted();
        }
        quorum.voted[did] = true;
        quorum.votes++;

        bool invalidated = false;
        bool maxReached = false;
        // Check if the quorum threshold is met
        if (quorum.votes * 3 >= totalOracles * 2) {
            // Reset the seed and let the oracle submit a new one
            inputSeed.seed = "";
            invalidated = true;
            // If maximum seed submissions are reached, mark the request as failed
            if (inputSeed.submissions == Constants.MAX_SEED_PER_REQUEST) {
                maxReached = true;
            }
        }
        return (invalidated, maxReached);
    }
} 