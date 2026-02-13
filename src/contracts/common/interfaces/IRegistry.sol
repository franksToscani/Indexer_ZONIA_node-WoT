// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.0;

import "../libraries/types/DataTypes.sol";

interface IRegistry {
    function register(string memory did) external;

    function deregister() external;

    function ban(address addr) external;

    function banVote(string calldata did, string calldata targetDid) external;

    function updateRequiredStake(uint256 newStake) external;

    function updateScores(
        address[] memory addrs,
        int256[] memory scores
    ) external;

    function isRegistered(
        string memory did,
        address addr
    ) external view returns (bool);

    function total() external view returns (uint256);

    function getAddressFromDid(string memory did) external view returns (address);

    function getAllNodes() external view returns (DataTypes.Node[] memory nodes);

    function getNodes(
        address[] memory addrs
    ) external view returns (DataTypes.Node[] memory nodes);

}