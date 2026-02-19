// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "./common/interfaces/IRegistry.sol";
import "./common/interfaces/IZoniaToken.sol";
import "./common/access/GateControllable.sol";
import "./common/libraries/types/Constants.sol";
import "./common/libraries/types/DataTypes.sol";
import "./common/libraries/types/Errors.sol";
import "./common/libraries/types/Events.sol";
import "./common/libraries/services/helpers/QuorumTracker.sol";

abstract contract Registry is IRegistry, GateControllable {
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    IZoniaToken internal _zoniaToken;
    uint256 internal _stakeAmount;

    mapping(string => address) internal _dids;
    mapping(address => string) internal _addresses;
    EnumerableMap.AddressToUintMap internal _stakings;
    mapping(string => DataTypes.QuorumVote) internal _banQuorum;

    constructor(address gateAddress, address zoniaTokenAddress) GateControllable(gateAddress) {
        _zoniaToken = IZoniaToken(zoniaTokenAddress);
    }

    function register(string memory did) public virtual override {
        require(_dids[did] == address(0), "DID already registered");
        require(bytes(_addresses[msg.sender]).length == 0, "Address already used");
        require(_zoniaToken.transferFrom(msg.sender, address(this), _stakeAmount), "Stake transfer failed");
        
        _dids[did] = msg.sender;
        _addresses[msg.sender] = did;
        _stakings.set(msg.sender, _stakeAmount);

        emit Events.ScoreUpdated(did, msg.sender, Constants.FIXED_INITIAL_REPUTATION, block.timestamp);
    }

    function deregister() public virtual override {
        require(bytes(_addresses[msg.sender]).length != 0 , "Address has no DID registered");

        delete _dids[_addresses[msg.sender]];
        delete _addresses[msg.sender];

        _zoniaToken.transfer(msg.sender, _stakings.get(msg.sender));
        _stakings.remove(msg.sender);
    }


    function ban(address addr) public override onlyGate {
        string memory did = _addresses[addr];

        delete _addresses[addr];
        delete _dids[did];
        _stakings.remove(addr);

        emit Events.DIDBanned(did, addr);
    }

    function banVote(
        string calldata did,
        string calldata targetDid
    ) external override onlyGate {
        if (_dids[targetDid] == address(0)) {
            revert Errors.DIDNotRegistered();
        }
        bool banned = QuorumTracker.commitVote(
            did,
            _stakings.length(),
            _banQuorum[targetDid]
        );
        if (banned) {
            address targetAddr = _dids[targetDid];
            ban(targetAddr);
        }
    }

    function updateRequiredStake(uint256 newStake) external override {
        _stakeAmount = newStake;
    }

    function updateScores(
        address[] memory addrs,
        int256[] memory scores
    ) external override onlyGate {
        for (uint256 i = 0; i < addrs.length; i++) {
            string memory did = _addresses[addrs[i]];
            if (bytes(did).length != 0) {
                emit Events.ScoreUpdated(did, addrs[i], scores[i], block.timestamp);
            }
        }
    }

    function isRegistered(
        string memory did,
        address addr
    ) external view override returns (bool) {
        return _dids[did] == addr;
    }

    function total() external view override returns (uint256) {
        return _stakings.length();
    }

    function getAddressFromDid(
        string memory did
    ) external view override returns (address) {
        return _dids[did];
    }

    function getAllNodes() external view override returns (DataTypes.Node[] memory nodes) {
        uint256 totalDIDs = _stakings.length();
        nodes = new DataTypes.Node[](totalDIDs);

        for (uint256 i = 0; i < totalDIDs; i++) {
            (address addr, ) = _stakings.at(i);
            string memory did = _addresses[addr];
            nodes[i] = DataTypes.Node(did, addr);
        }
    }

    function getNodes(
        address[] memory addrs
    ) external view override returns (DataTypes.Node[] memory nodes) {
        nodes = new DataTypes.Node[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            nodes[i] = DataTypes.Node(_addresses[addrs[i]], addrs[i]);
        }
    }
}