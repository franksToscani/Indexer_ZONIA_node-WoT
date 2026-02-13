// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../types/DataTypes.sol";
import "../types/Errors.sol";
import "../types/Events.sol";
import "../types/Constants.sol";
import "../../interfaces/IZoniaToken.sol";
import "../../interfaces/IRegistry.sol";
import "./RequestManager.sol";

library PriceQuery {
    function trySubmitQuery(
        DataTypes.SupportedChainsInfo storage chainsInfo,
        mapping(bytes32 => DataTypes.Request) storage requests,
        IRegistry oracleRegistry,
        IRegistry indexerRegistry,
        IZoniaToken zoniaToken
    ) internal {
        if (
            zoniaToken.balanceOf(address(this)) <
            Constants.FIXED_PRICE_QUERY_FEE
        ) {
            return;
        }

        string memory targetChain = chainsInfo.chains[
            chainsInfo.nextPriceQueryChain
        ];
        string memory query = string(
            abi.encodePacked(
                '{"topic":"',
                Constants.FIXED_PRICE_QUERY_STRING,
                targetChain,
                '"}'
            )
        );
        DataTypes.InputRequest memory inputRequest = DataTypes.InputRequest({
            query: query,
            chainParams: chainsInfo.defaultChainParams,
            ko: oracleRegistry.total(),
            ki: indexerRegistry.total(),
            fee: Constants.FIXED_PRICE_QUERY_FEE
        });

        zoniaToken.approve(address(this), Constants.FIXED_PRICE_QUERY_FEE);
        bytes32 id = RequestManager.getRequestId(inputRequest);
        RequestManager.submitRequest(
            address(this),
            inputRequest,
            requests[id],
            oracleRegistry,
            zoniaToken
        );

        chainsInfo.isPriceRequest[id] = true;
        chainsInfo.requestChainMap[id] = targetChain;
        // Update the next chain index, cycling through the available chains
        chainsInfo.nextPriceQueryChain = 
            (chainsInfo.nextPriceQueryChain + 1) % uint8(chainsInfo.chains.length);

        emit Events.RequestSubmitted(id, address(this));
    }

    function tryUpdateChainPrice(
        bytes32 requestId,
        string memory price,
        DataTypes.SupportedChainsInfo storage chainsInfo
    ) internal {
        if (!chainsInfo.isPriceRequest[requestId]) {
            return;
        }

        string memory targetChain = chainsInfo.requestChainMap[requestId];
        emit Events.ChainPriceUpdated(
            targetChain,
            price,
            block.timestamp
        );

        delete chainsInfo.isPriceRequest[requestId];
        delete chainsInfo.requestChainMap[requestId];
    }
}
