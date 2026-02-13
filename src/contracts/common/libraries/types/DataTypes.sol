// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

library DataTypes {
    enum RequestStatus { Void, Created, Ready, Completed, Failed }

    struct Node {
        string did;
        address addr;
    }

    struct ChainParams {
        uint256 w1;
        uint256 w2;
        uint256 w3;
        uint256 w4;
    }

    struct InputRequest {
        string query;
        ChainParams chainParams;
        uint256 ko;
        uint256 ki;
        uint256 fee;
    }
    
    struct SupportedChainsInfo {
        string[] chains;
        ChainParams defaultChainParams;
        mapping(bytes32 => bool) isPriceRequest;
        mapping(bytes32 => string) requestChainMap;
        uint8 nextPriceQueryChain;
    }

    struct ChainPrice {
        string chain;
        string price;
    }

    struct Request {
        string query;
        ChainParams chainParams;
        address consumer;
        uint256 fee;
        uint256 timestamp;
        uint256 ko;
        uint256 ki;
        RequestStatus status;
        string result;
        Node[] indexers;
        Node[] committee;
    }

    struct QuorumCommit {
        mapping(string => bool) voted;
        mapping(bytes32 => uint256) votes;
        bytes32 acceptedHash;
        bool closed;
    }

    struct QuorumVote {
        uint256 votes;
        mapping(string => bool) voted;
    }

    struct InputSeed {
        string seed;
        string pubKey;
        address submitter;
        uint256 submissions;
        mapping(uint256 => QuorumVote) invalidationQuorum;
    }

    struct OracleData {
        string did;
        uint256 timestamp;
        string hashData;
        string[] dataPoints;
    }

    struct Results {
        mapping(string => bool) voted;
        mapping(string => uint256) votes;
        string[] options;
        uint256 submissions;
    }

    // Info associated with the request, stored on the same blockchain as the request
    struct RequestInfo {
        QuorumVote closeIndexerReg;
        // Committee Selection
        InputSeed inputSeed;
        mapping(uint256 => QuorumCommit) committeeSelection;
        mapping(string => bool) isCommittee;
        mapping(string => bool) isIndexer;
        // Submit Results
        Results results;
        // Score Updates
        QuorumCommit scoreUpdates;
    }

    // Data associated with the request, stored on the selected blockchain
    struct DataGathering {
        mapping(string => OracleData) data;
        uint256 submittedHash;
        uint256 submittedData;
    }
}