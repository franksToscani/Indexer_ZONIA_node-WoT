// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./common/interfaces/IGate.sol";
import "./common/interfaces/IRegistry.sol";
import "./common/interfaces/IZoniaToken.sol";
import "./common/libraries/types/DataTypes.sol";
import "./common/libraries/types/Errors.sol";
import "./common/libraries/types/Events.sol";
import "./common/libraries/services/RequestManager.sol";
import "./common/libraries/services/SeedValidator.sol";
import "./common/libraries/services/CommitteeManager.sol";
import "./common/libraries/services/IndexerRegistration.sol";
import "./common/libraries/services/DataSubmissionManager.sol";
import "./common/libraries/services/ScoreManager.sol";
import "./common/libraries/services/PriceQuery.sol";
import "./common/libraries/services/helpers/PaymentDistributor.sol";

contract Gate is IGate, Ownable {
    IRegistry internal _oracleRegistry;
    IRegistry internal _indexerRegistry;
    IZoniaToken internal _zoniaToken;
    DataTypes.SupportedChainsInfo internal _chainsInfo;

    using PaymentDistributor for IZoniaToken;

    mapping(bytes32 => DataTypes.Request) internal _requests;
    mapping(bytes32 => DataTypes.RequestInfo) internal _requestsInfo;
    mapping(bytes32 => DataTypes.DataGathering) internal _requestsData;
    mapping(address => uint256) internal _invalidSeedPerOracle;

    modifier requestExists(bytes32 requestId) {
        if (_requests[requestId].status == DataTypes.RequestStatus.Void)
            revert Errors.NoRequestFound();
        _;
    }
    modifier isRequestInStatus(bytes32 requestId, DataTypes.RequestStatus status) {
        if (_requests[requestId].status == DataTypes.RequestStatus.Void)
            revert Errors.NoRequestFound();
        if (_requests[requestId].status != status)
            revert Errors.InvalidRequestStatus(_requests[requestId].status);
        _;
    }
    modifier onlyIndexer(string memory did) {
        if (!_indexerRegistry.isRegistered(did, msg.sender))
            revert Errors.NotIndexer();
        _;
    }
    modifier onlyOracle(string memory did) {
        if (!_oracleRegistry.isRegistered(did, msg.sender))
            revert Errors.NotOracle();
        _;
    }
    modifier onlyCommittee(string memory did, bytes32 requestId) {
        if (!_requestsInfo[requestId].isCommittee[did])
            revert Errors.NotCommittee();
        _;
    }

    constructor(DataTypes.ChainParams memory priceQueryParams) Ownable(msg.sender) {
        _chainsInfo.defaultChainParams = priceQueryParams;
    }

    function setOracleRegistryContract(address contractAddress) external onlyOwner {
        _oracleRegistry = IRegistry(contractAddress);
    }

    function setIndexerRegistryContract(address contractAddress) external onlyOwner {
        _indexerRegistry = IRegistry(contractAddress);
    }

    function setZoniaTokenContract(address contractAddress) external onlyOwner {
        _zoniaToken = IZoniaToken(contractAddress);
    }

    function setSupportedChains(string[] memory chains) external onlyOwner {
        _chainsInfo.chains = chains;
        _chainsInfo.nextPriceQueryChain = 0;
    }

    function submitRequest(
        DataTypes.InputRequest calldata inputRequest
    ) external override returns (bytes32) {
        bytes32 id = RequestManager.getRequestId(inputRequest);
        RequestManager.submitRequest(
            msg.sender,
            inputRequest,
            _requests[id],
            _oracleRegistry,
            _zoniaToken
        );
        emit Events.RequestSubmitted(id, msg.sender);
        
        PriceQuery.trySubmitQuery(
            _chainsInfo,
            _requests,
            _oracleRegistry,
            _indexerRegistry,
            _zoniaToken
        );
        return id;
    }

    function submitSeed(
        string memory did,
        bytes32 requestId,
        string calldata seed,
        string calldata pubKey
    ) external override onlyOracle(did) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        DataTypes.InputSeed storage inputSeed = _requestsInfo[requestId].inputSeed;
        if (bytes(inputSeed.seed).length != 0) revert Errors.SeedAlreadySubmitted();
        inputSeed.seed = seed;
        inputSeed.pubKey = pubKey;
        inputSeed.submitter = msg.sender;
        inputSeed.submissions++;
        emit Events.RequestSeeded(requestId, seed, pubKey, msg.sender);
    }

    function invalidateSeed(
        string memory did,
        bytes32 requestId
    ) external override requestExists(requestId) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        address submitter = _requestsInfo[requestId].inputSeed.submitter;
        (bool invalidated, bool maxReached) = SeedValidator.invalidateSeed(
            did,
            _requestsInfo[requestId].inputSeed,
            _oracleRegistry.total()
        );
        if (invalidated) {
            emit Events.RequestSeedInvalidated(requestId);
            _invalidSeedPerOracle[submitter]++;
        }
        if (_invalidSeedPerOracle[submitter] == Constants.MAX_INVALID_SEED_PER_ORACLE) {
            // This event triggers a ban of the submitter oracle across all chains (expect this one)
            emit Events.OracleMaxInvalidSeedReached(submitter, _invalidSeedPerOracle[submitter]);
            _oracleRegistry.ban(submitter);
        }
        if (maxReached) {
            DataTypes.Request storage request = _requests[requestId];
            request.status = DataTypes.RequestStatus.Failed;
            request.result = "Maximum number of invalid seed submissions reached";
            emit Events.RequestFailed(requestId, request.result);
        }
    }

    function submitCommitteeHash(
        string memory did,
        bytes32 requestId,
        bytes32 committeeHash
    ) external override onlyOracle(did) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        bool locked = CommitteeManager.submitCommitteeHash(
            did,
            committeeHash,
            _requestsInfo[requestId],
            _oracleRegistry
        );
        if (locked) {
            emit Events.CommitteeHashLocked(requestId, committeeHash);
        }
    }

    function submitCommittee(
        string memory did,
        bytes32 requestId,
        address[] calldata committee
    ) external override onlyOracle(did) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        DataTypes.Request storage request = _requests[requestId];
        CommitteeManager.submitCommittee(
            committee,
            request,
            _requestsInfo[requestId],
            _oracleRegistry
        );

        // Reward the seed submitter by transferring a percentage of the fee
        DataTypes.InputSeed storage inputSeed = _requestsInfo[requestId].inputSeed;
        uint256 reward = request.fee * Constants.FIXED_SEED_SUBMITTER_REWARD_PERCENTAGE / 100;
        _zoniaToken.transferFrom(request.consumer, address(this), reward);
        _zoniaToken.transfer(inputSeed.submitter, reward);

        emit Events.OracleCommitteeSelected(requestId, request.committee);
    }

    function applyToRequest(
        string memory did,
        bytes32 requestId
    ) external override onlyIndexer(did) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        DataTypes.Node memory indexer = IndexerRegistration.applyToRequest(
            did,
            _requests[requestId],
            _requestsInfo[requestId]
        );
        emit Events.IndexerVolunteer(requestId, indexer);
    }

    function closeIndexerRegistration(
        string memory did,
        bytes32 requestId
    ) external override onlyCommittee(did, requestId) isRequestInStatus(requestId, DataTypes.RequestStatus.Created) {
        DataTypes.Request storage request = _requests[requestId];
        DataTypes.RequestInfo storage info = _requestsInfo[requestId];
        bool close = IndexerRegistration.closeRegistration(
            did,
            request,
            info.closeIndexerReg
        );
        if (close) {
            request.status = DataTypes.RequestStatus.Ready;
            emit Events.RequestReady(requestId, info.inputSeed.seed);
        }
    }

    function submitHash(
        string memory did,
        bytes32 requestId,
        string memory hashData
    ) external override onlyOracle(did) {
        DataSubmissionManager.submitHash(
            did,
            hashData,
            _requestsData[requestId]
        );
        emit Events.HashSubmitted(
            requestId,
            did,
            hashData,
            _requestsData[requestId].submittedHash
        );
    }

    function submitDataPoints(
        string memory did,
        bytes32 requestId,
        string[] memory dataPoints
    ) external override onlyOracle(did) {
        DataSubmissionManager.submitDataPoints(
            did,
            dataPoints,
            _requestsData[requestId]
        );
        emit Events.DataPointsSubmitted(
            requestId,
            did,
            dataPoints,
            _requestsData[requestId].submittedData
        );
    }

    function submitResult(
        string memory did,
        bytes32 requestId,
        string memory result
    ) external override requestExists(requestId) onlyCommittee(did, requestId) {
        if (
            _requests[requestId].status == DataTypes.RequestStatus.Completed ||
            _requests[requestId].status == DataTypes.RequestStatus.Failed
        ) revert Errors.AlreadyCompleted();
        (bool completed, bool failed, string memory finalResult) = RequestManager.submitResult(
            did,
            result,
            _requests[requestId],
            _requestsInfo[requestId]
        );
        if (completed) {
            emit Events.RequestCompleted(requestId, finalResult);
            PriceQuery.tryUpdateChainPrice(requestId, finalResult, _chainsInfo);
        } else if (failed) {
            emit Events.RequestFailed(requestId, finalResult);
        }
    }

    function submitRequestTimeout(
        string memory did,
        bytes32 requestId,
        string memory result
    ) external override requestExists(requestId) onlyCommittee(did, requestId) {
        if (
            _requests[requestId].status == DataTypes.RequestStatus.Completed ||
            _requests[requestId].status == DataTypes.RequestStatus.Failed
        ) revert Errors.AlreadyCompleted();
        bool failed = RequestManager.submitRequestTimeout(
            result,
            _requests[requestId]
        );
        if (failed) {
            emit Events.RequestFailed(requestId, result);
        }
    }

    function commitScoreHash(string memory did, bytes32 requestId, bytes32 scoreHash)  external override requestExists(requestId) onlyCommittee(did, requestId) {
        bool locked = ScoreManager.commitScoreHash(
            did,
            scoreHash,
            _requests[requestId],
            _requestsInfo[requestId].scoreUpdates
        );
        if (locked) {
            emit Events.ScoreHashLocked(requestId, scoreHash);
        }
    }

    function updateScores(
        string memory did,
        bytes32 requestId,
        address[] calldata idxAddrs,
        int256[] calldata idxScores,
        address[] calldata oraAddrs,
        int256[] calldata oraScores
    ) external override requestExists(requestId) onlyCommittee(did, requestId) {
        ScoreManager.updateScores(
            _requestsInfo[requestId].scoreUpdates,
            idxAddrs,
            idxScores,
            oraAddrs,
            oraScores,
            _indexerRegistry,
            _oracleRegistry
        );
        RequestManager.distributePayments(
            _requests[requestId],
            idxAddrs,
            oraAddrs,
            _zoniaToken
        );
        emit Events.ScoresUpdated(requestId, idxAddrs, idxScores, oraAddrs, oraScores);
    }

    function banOracles(
        string calldata did,
        string[] calldata targetDids
    ) external override onlyOracle(did) {
        for (uint256 i = 0; i < targetDids.length; i++) {
            _oracleRegistry.banVote(did, targetDids[i]);
        }
    }

    function banIndexers(
        string calldata did,
        string[] calldata targetDids
    ) external override onlyOracle(did) {
        for (uint256 i = 0; i < targetDids.length; i++) {
            _indexerRegistry.banVote(did, targetDids[i]);
        }
    }

    /** Getter Functions */

    function getResult(
        bytes32 requestId
    ) external view override requestExists(requestId) returns (string memory) {
        return _requests[requestId].result;
    }

    function getRequest(
        bytes32 requestId
    )
        external
        view
        override
        requestExists(requestId)
        returns (DataTypes.Request memory)
    {
        return _requests[requestId];
    }

    function isCommitteeMember(
        string memory did,
        bytes32 requestId
    ) external view override requestExists(requestId) returns (bool) {
        return _requestsInfo[requestId].isCommittee[did];
    }

    /**
     * @dev Function to get the request data for a given requestId
     * @param requestId The ID of the request
     * @param oraclesDids The DIDs of the oracles to retrieve data for
     * @param limitTimestamp The timestamp limit to filter oracle data
     * @return The request data, including the hash and data points submitted by oracles
     */
    function getOracleRequestData(
        bytes32 requestId,
        string[] calldata oraclesDids,
        uint256 limitTimestamp
    )
        external
        view
        override
        returns (DataTypes.OracleData[] memory)
    {
        DataTypes.DataGathering storage requestData = _requestsData[requestId];
        DataTypes.OracleData[] memory oracleData = new DataTypes.OracleData[](
            oraclesDids.length
        );

        for (uint256 i = 0; i < oraclesDids.length; i++) {
            DataTypes.OracleData storage oracle = requestData.data[oraclesDids[i]];
            if (oracle.timestamp < limitTimestamp) {
                oracleData[i] = oracle;
            } else {
                oracleData[i] = DataTypes.OracleData({
                    did: oraclesDids[i],
                    timestamp: 0,
                    hashData: "",
                    dataPoints: new string[](0)
                });
            }
        }

        return oracleData;
    }
}
