// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "./DataTypes.sol";

library Events {
    event IndexerRegistered(string indexed did, address indexed indexer);
    event IndexerDeregistered(string indexed did, address indexed indexer);
    event OracleRegistered(string indexed did, address indexed indexer);
    event OracleDeregistered(string indexed did, address indexed indexer);

    event RequestSubmitted(bytes32 indexed requestId, address indexed sender);
    event RequestSeeded(bytes32 indexed requestId, string seed, string pubKey, address submitter);
    event RequestReady(bytes32 indexed requestId, string seed);
    event RequestCompleted(bytes32 indexed requestId, string result);
    event RequestFailed(bytes32 indexed requestId, string result);

    event RequestSeedInvalidated(bytes32 indexed requestId);
    event OracleMaxInvalidSeedReached(address oracle, uint256 invalidSubmissions);
    event CommitteeHashLocked(bytes32 indexed requestId, bytes32 committeeHash);
    event OracleCommitteeSelected(bytes32 indexed requestId, DataTypes.Node[] oracles);
    event IndexerVolunteer(bytes32 indexed requestId, DataTypes.Node indexer);
    event HashSubmitted(bytes32 indexed requestId, string did, string hashData, uint256 submittedHash);
    event DataPointsSubmitted(bytes32 indexed requestId, string did, string[] dataPoints, uint256 submittedData);
    event ScoreHashLocked(bytes32 indexed requestId, bytes32 scoreHash);
    event ScoresUpdated(
        bytes32 indexed requestId,
        address[] idxAddrs,
        int256[] idxScores,
        address[] oraAddrs,
        int256[] oraScores
    );

    event ScoreUpdated(
        string indexed did,
        address addr,
        int256 score,
        uint256 timestamp
    );
    event DIDBanned(string indexed didToBan, address addrToBan);

    event ChainPriceUpdated(string indexed targetChain, string price, uint256 timestamp);
}