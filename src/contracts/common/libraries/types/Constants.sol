// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

library Constants {
    uint256 internal constant DEFAULT_ORACLE_REQUIRED_STAKE = 1000;
    uint256 internal constant DEFAULT_INDEXER_REQUIRED_STAKE = 1000;
    
    int256 internal constant FIXED_INITIAL_REPUTATION = 0;
    uint256 internal constant FIXED_TIME_FOR_ERROR_SUBMISSION = 10 seconds;
    
    uint256 internal constant FIXED_SEED_SUBMITTER_REWARD_PERCENTAGE = 10;
    uint256 internal constant FIXED_GATE_REWARD_PERCENTAGE = 10;
    
    /// @dev Query string prefix for fixed price retrieval.
    string internal constant FIXED_PRICE_QUERY_STRING = 'zonia:Price'; // e.g., "zonia:Price<targetChain>".
    uint256 internal constant FIXED_PRICE_QUERY_FEE = 20;

    uint256 internal constant MAX_SEED_PER_REQUEST = 5;
    uint256 internal constant MAX_INVALID_SEED_PER_ORACLE = 5;
}