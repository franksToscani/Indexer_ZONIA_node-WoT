// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "./DataTypes.sol";

library Errors {
    error NotIndexer();
    error NotOracle();
    error NotCommittee();
    error NotGate();

    error DIDNotRegistered();

    // Flow Erros
    error RequestAlreadySubmitted();
    error IndexerAlreadyRegistered();
    error SeedAlreadySubmitted();
    error CommitteeAlreadySelected();
    error HashAlreadySubmitted();
    error DataPointsAlreadySubmitted();
    error NoHashSubmitted();
    error SubmissionTimeNotPassed();
    error AlreadyCompleted();

    // Quorum Errors
    error HashAlreadyLocked();
    error AlreadyVoted();
    error HashNotLocked();
    error InvalidHash();
    error QuorumClosed();

    // Invalid Input
    error InvalidGateAddress();
    error InsufficientBalance();
    error EmptyQuery();
    error EmptyHash();
    error EmptyFee();
    error InvalidChainWeights();
    error InvalidOraclesLength();
    error SeedNotSubmitted();
    error NoRequestFound();
    error NotEnoughOracles();

    error InvalidRequestStatus(DataTypes.RequestStatus actual);
}