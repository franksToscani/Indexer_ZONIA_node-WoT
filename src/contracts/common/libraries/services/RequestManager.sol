// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";
import "../types/Constants.sol";
import "./helpers/PaymentDistributor.sol";
import "../../interfaces/IRegistry.sol";
import "../../interfaces/IZoniaToken.sol";

library RequestManager {
    function submitRequest(
        address consumer,
        DataTypes.InputRequest memory inputRequest,
        DataTypes.Request storage request,
        IRegistry oracleRegistry,
        IZoniaToken zoniaToken
    ) internal {
        if (bytes(inputRequest.query).length == 0) revert Errors.EmptyQuery();
        if (inputRequest.fee == 0) revert Errors.EmptyFee();
        if (inputRequest.chainParams.w1 + 
            inputRequest.chainParams.w2 + 
            inputRequest.chainParams.w3 + 
            inputRequest.chainParams.w4 != 100) revert Errors.InvalidChainWeights();

        if (
            zoniaToken.allowance(consumer, address(this)) < inputRequest.fee ||
            zoniaToken.balanceOf(consumer) < inputRequest.fee
        ) {
            revert Errors.InsufficientBalance();
        }

        if (request.status != DataTypes.RequestStatus.Void)
            revert Errors.RequestAlreadySubmitted();
        
        uint256 oracles = oracleRegistry.total();
        if (inputRequest.ko > oracles) {
            revert Errors.NotEnoughOracles();
        }

        request.query          = inputRequest.query;
        request.chainParams    = inputRequest.chainParams;
        request.consumer       = consumer;
        request.fee            = inputRequest.fee;
        request.timestamp      = block.timestamp;
        request.ko             = inputRequest.ko;
        request.ki             = inputRequest.ki;
        request.status         = DataTypes.RequestStatus.Created;
    }

    function submitResult(
        string memory did,
        string memory result,
        DataTypes.Request storage request,
        DataTypes.RequestInfo storage requestInfo
    ) internal returns (bool completed, bool failed, string memory finalResult) {
        DataTypes.Results storage results = requestInfo.results;
        if (results.voted[did]) {
            revert Errors.AlreadyVoted();
        }
        results.voted[did] = true;
        
        if (results.votes[result] == 0) {
            results.options.push(result);
        }
        results.votes[result]++;
        results.submissions++;

        if (results.votes[result] * 3 >= request.ko * 2) {
            request.status = DataTypes.RequestStatus.Completed;
            request.result = result;
            return (true, false, result);
        }

        if (results.submissions == request.ko) {
            request.status = DataTypes.RequestStatus.Failed;
            request.result = "No consensus reached for the result";
            return (false, true, request.result);
        }

        return (false, false, "");
    }

    function submitRequestTimeout(
        string memory result,
        DataTypes.Request storage request
    ) internal returns (bool failed) {
        if (block.timestamp >= request.timestamp + Constants.FIXED_TIME_FOR_ERROR_SUBMISSION) {
            request.status = DataTypes.RequestStatus.Failed;
            request.result = result;
            return true;
        }
        return false;
    }

    function distributePayments(
        DataTypes.Request memory request,
        address[] calldata idxAddrs,
        address[] calldata oraAddrs,
        IZoniaToken zoniaToken
    ) internal {
        // Subtract reward given to seed submitter
        uint256 fee = request.fee - (request.fee * Constants.FIXED_SEED_SUBMITTER_REWARD_PERCENTAGE / 100);

        zoniaToken.transferFrom(request.consumer, address(this), fee);

        // Subtract reward taken by Gate
        fee = fee - (request.fee * Constants.FIXED_GATE_REWARD_PERCENTAGE / 100);
        PaymentDistributor.distribute(
            zoniaToken,
            idxAddrs,
            oraAddrs,
            fee
        );
    }
    
    function getRequestId(
        DataTypes.InputRequest memory inputRequest
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    block.timestamp,
                    block.chainid,
                    inputRequest.query,
                    inputRequest.chainParams.w1,
                    inputRequest.chainParams.w2,
                    inputRequest.chainParams.w3,
                    inputRequest.chainParams.w4,
                    inputRequest.ko,
                    inputRequest.ki
                )
            );
    }
} 