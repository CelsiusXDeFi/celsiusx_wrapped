// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20FlashMintUpgradeable.sol";

import "../capabilities/Mintable.sol";

contract ERC3156FlashBorrowerReentrancy {
    bytes32 internal constant _RETURN_VALUE_ =
        keccak256("ERC3156FlashBorrower.onFlashLoan");

    function onFlashLoan(
        address, /* initiator */
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) public returns (bytes32) {
        IERC20Upgradeable(token).approve(token, 7 * (amount + fee));

        Mintable(token).flashLoan(
            IERC3156FlashBorrowerUpgradeable(address(this)),
            token,
            amount,
            data
        );

        return _RETURN_VALUE_;
    }
}
