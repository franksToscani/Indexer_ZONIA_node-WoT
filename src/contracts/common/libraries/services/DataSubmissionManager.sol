// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";

library DataSubmissionManager {
    function submitHash(
        string memory did,
        string memory hashData,
        DataTypes.DataGathering storage requestData
    ) internal {
        if (bytes(hashData).length == 0) revert Errors.EmptyHash();

        if (requestData.data[did].timestamp != 0)
            revert Errors.HashAlreadySubmitted();

        requestData.data[did] = DataTypes.OracleData(
            did,
            block.timestamp,
            hashData,
            new string[](0)
        );
        requestData.submittedHash++;
    }

    function submitDataPoints(
        string memory did,
        string[] memory dataPoints,
        DataTypes.DataGathering storage requestData
    ) internal {
        DataTypes.OracleData storage data = requestData.data[did];

        if (data.timestamp == 0) revert Errors.NoHashSubmitted();
        if (data.dataPoints.length != 0)
            revert Errors.DataPointsAlreadySubmitted();

        data.dataPoints = dataPoints;
        requestData.submittedData++;
    }
} 