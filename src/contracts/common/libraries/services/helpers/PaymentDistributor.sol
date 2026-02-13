// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../../interfaces/IZoniaToken.sol";
import "../../types/DataTypes.sol";

library PaymentDistributor {
    /// @notice Equally distributes the fee among selected oracles and indexers
    function distribute(
        IZoniaToken token,
        address[] calldata idxAddrs,
        address[] calldata oraAddrs,
        uint256 fee
    ) internal {
        uint256 totalCount = oraAddrs.length + idxAddrs.length;
        if (totalCount == 0) return;

        uint256 share = fee / totalCount;

        // pay oracles
        for (uint i = 0; i < oraAddrs.length; i++) {
            token.transfer(oraAddrs[i], share);
        }

        // pay indexers
        for (uint i = 0; i < idxAddrs.length; i++) {
            token.transfer(idxAddrs[i], share);
        }
    }
}
