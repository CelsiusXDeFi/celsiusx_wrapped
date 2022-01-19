// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC3156Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERC3156FlashBorrowerMockUpgradeable is
    Initializable,
    IERC3156FlashBorrowerUpgradeable
{
    bytes32 internal constant _RETURN_VALUE =
        keccak256("ERC3156FlashBorrower.onFlashLoan");

    bool _enableApprove;
    bool _enableReturn;

    event BalanceOf(address token, address account, uint256 value);
    event TotalSupply(address token, uint256 value);

    function __ERC3156FlashBorrowerMock_init(
        bool enableReturn,
        bool enableApprove
    ) internal initializer {
        __ERC3156FlashBorrowerMock_init_unchained(enableReturn, enableApprove);
    }

    function __ERC3156FlashBorrowerMock_init_unchained(
        bool enableReturn,
        bool enableApprove
    ) internal initializer {
        _enableApprove = enableApprove;
        _enableReturn = enableReturn;
    }

    function onFlashLoan(
        address, /*initiator*/
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) public override returns (bytes32) {
        require(msg.sender == token);

        emit BalanceOf(
            token,
            address(this),
            IERC20Upgradeable(token).balanceOf(address(this))
        );
        emit TotalSupply(token, IERC20Upgradeable(token).totalSupply());

        if (data.length > 0) {
            // WARNING: This code is for testing purposes only! Do not use.
            AddressUpgradeable.functionCall(token, data);
        }

        if (_enableApprove) {
            IERC20Upgradeable(token).approve(token, amount + fee);
        }

        return _enableReturn ? _RETURN_VALUE : bytes32(0);
    }

    uint256[50] private __gap;
}

contract ERC3156FlashBorrowerMock is ERC3156FlashBorrowerMockUpgradeable {
    constructor(bool enableReturn, bool enableApprove) {
        __ERC3156FlashBorrowerMock_init(enableReturn, enableApprove);
    }
}
