// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import "./EscrowerRole.sol";

/**
 * Keeps track of transfers that have been requested and locked up in escrow.
 * An administrator is required to approve/reject transfer proposals.
 * A user can cancel a previously requested transfer that is locked in escrow.
 */
contract Escrowable is ERC20Upgradeable, EscrowerRole {
    // Event emitted when a proposal is created/updated
    event TransferProposalUpdated(
        address indexed updatedBy,
        uint256 requestId,
        ProposalState state
    );

    // The valid states a proposal can be in
    enum ProposalState {
        Pending,
        Approved,
        Rejected,
        Canceled
    }

    // The struct tracking each transfer proposal
    struct TransferProposal {
        address createdBy;
        address from;
        address to;
        uint256 value;
        ProposalState state;
    }

    // Transfer requests will be tracked by a monotonic ID that increases after each proposal is created
    uint256 numTransferProposals;
    mapping(uint256 => TransferProposal) public transferProposals;

    /**
     * Internal function to create a new proposal that will lock funds into escrow.  This should only be called
     * once the balances are confirmed to be sufficient to create the proposal (account should have enough funds outside of proposals)
     */
    function _createTransferProposal(address to, uint256 value)
        internal
        returns (bool)
    {
        // Save off the transfer request
        transferProposals[numTransferProposals] = TransferProposal(
            msg.sender,
            msg.sender,
            to,
            value,
            ProposalState.Pending
        );

        // Emit the request event
        emit TransferProposalUpdated(
            msg.sender,
            numTransferProposals,
            ProposalState.Pending
        );

        // Increment the request counter
        numTransferProposals = numTransferProposals + 1;

        // Move the tokens into this contract
        ERC20Upgradeable.transfer(address(this), value);

        return true;
    }

    /**
     * Internal function to create a new proposal from a 3rd party account that will lock funds into escrow.  This should only be called
     * once the balances are confirmed to be sufficient to create the proposal (account should have enough funds outside of proposals, and
     * the calling account has been approved to transfer the amount)
     */
    function _createTransferFromProposal(
        address from,
        address to,
        uint256 value
    ) internal returns (bool) {
        // Save off the transfer request
        transferProposals[numTransferProposals] = TransferProposal(
            msg.sender,
            from,
            to,
            value,
            ProposalState.Pending
        );

        // Emit the request event
        emit TransferProposalUpdated(
            msg.sender,
            numTransferProposals,
            ProposalState.Pending
        );

        // Increment the request counter
        numTransferProposals = numTransferProposals + 1;

        // Move the tokens into this contract
        ERC20Upgradeable.transferFrom(from, address(this), value);

        return true;
    }

    function _releaseProposal(
        TransferProposal storage request,
        uint256 requestId,
        ProposalState newState
    ) internal {
        // Update request
        request.state = newState;
        emit TransferProposalUpdated(msg.sender, requestId, request.state);
    }

    /**
     * An administrator has the ability to approve a proposal.  During approval process, funds will be moved
     * to the target account.
     */
    function _approveTransferProposal(uint256 requestId) internal {
        // Ensure the request ID is valid
        require(
            requestId < numTransferProposals,
            "Request ID is not in proper range"
        );

        // Get the request
        TransferProposal storage request = transferProposals[requestId];

        // Ensure the request can be approved
        require(
            request.state == ProposalState.Pending,
            "Request must be in Pending state to approve."
        );

        // Release the proposal
        _releaseProposal(request, requestId, ProposalState.Approved);

        // Transfer funds - function will check balances
        ERC20Upgradeable._transfer(address(this), request.to, request.value);
    }

    /**
     * An administrator has the ability to reject a proposal.  During rejection process, funds will be unlocked
     * from the source account.
     */
    function _rejectTransferProposal(uint256 requestId) internal {
        // Ensure the request ID is valid
        require(
            requestId < numTransferProposals,
            "Request ID is not in proper range"
        );

        // Get the request
        TransferProposal storage request = transferProposals[requestId];

        // Ensure the request can be rejected
        require(
            request.state == ProposalState.Pending,
            "Request must be in Pending state to reject."
        );

        // Release the proposal
        _releaseProposal(request, requestId, ProposalState.Rejected);

        // Transfer funds back to source - function will check balances
        ERC20Upgradeable._transfer(address(this), request.from, request.value);
    }

    /**
     * If a user locks up funds in a proposal, they can cancel it as long as an administrator has not
     * already approved or rejected it.
     */
    function cancelTransferProposal(uint256 requestId) public {
        // Ensure the request ID is valid
        require(
            requestId < numTransferProposals,
            "Request ID is not in proper range"
        );

        // Get the request
        TransferProposal storage request = transferProposals[requestId];

        require(
            request.state == ProposalState.Pending,
            "Request must be in Pending state to cancel."
        );

        // Ensure the message sender it the address where funds are moving from
        require(
            msg.sender == request.createdBy,
            "Only the creator of a request can cancel it"
        );

        // Release the proposal
        _releaseProposal(request, requestId, ProposalState.Canceled);

        // Transfer funds back to source - function will check balances
        ERC20Upgradeable._transfer(address(this), request.from, request.value);
    }

    function getTransferProposal(uint256 requestId)
        public
        view
        returns (
            address createdBy,
            address from,
            address to,
            uint256 value,
            ProposalState state
        )
    {
        require(requestId < numTransferProposals, "requestId is out of range");
        TransferProposal storage request = transferProposals[requestId];
        createdBy = request.createdBy;
        from = request.from;
        to = request.to;
        value = request.value;
        state = request.state;
    }
}
