// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Sender {
    receive() external payable {}

    fallback() external payable {}

    function send(address receiver) public payable {
        selfdestruct(payable(receiver));
    }
}
