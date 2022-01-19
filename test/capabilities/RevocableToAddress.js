/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const WrappedTokenV1 = artifacts.require('WrappedTokenV1')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

const MockV3Aggregator = artifacts.require('MockV3Aggregator')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('RevocableToAddress', (accounts) => {
  
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const revokeeAccount = accounts[4]
  const revokedToAccount = accounts[5]
  
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {

    let mockReserveFeed = await MockV3Aggregator.new(Constants.decimals, Constants.supply)
    tokenDeploy = await WrappedTokenV1.new(Constants.name, Constants.symbol, mockReserveFeed.address);

    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await WrappedTokenV1.at(proxyInstance.address)

    await tokenInstance.initialize(
      accounts[0],
      Constants.name,
      Constants.symbol,
      Constants.supply.multipliedBy(0.01),
      mockReserveFeed.address,
      true,
      false);
  })

  it('Admin should be able to revoke tokens from any account to another', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = 25
    const afterRevokeAmount = transferAmount - revokeAmount

    await tokenInstance.addRevoker(adminAccount)

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // get the initial balances of the user and admin account and confirm balances
    const revokeeBalance = await tokenInstance.balanceOf(revokeeAccount)
    const revokedToBalance = await tokenInstance.balanceOf(revokedToAccount)
    assert.equal(revokeeBalance, transferAmount, 'User balance should intially be equal to the transfer amount')
    assert.equal(revokedToBalance, 0, 'Target balance should intially be 0')

    // revoke tokens from the user
    await tokenInstance.revokeToAddress(revokeeAccount, revokedToAccount, revokeAmount, { from: adminAccount })

    // get the updated balances for admin and user and confirm they are updated
    const revokeeBalanceRevoked = await tokenInstance.balanceOf(revokeeAccount)
    const revokedToBalanceAfter = await tokenInstance.balanceOf(revokedToAccount)
    assert.equal(revokeeBalanceRevoked, afterRevokeAmount, 'User balance should be reduced after tokens are revoked')
    assert.equal(revokedToBalanceAfter, revokeAmount, 'Target balance should be increased after tokens are revoked')
  })

  it('Non admins should not be able to revoke tokens', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = 25

    // transfer tokens from owner account to revokee account
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // attempt to revoke tokens from owner, whitelisted, and non whitelisted accounts; should all fail
    await expectRevert(tokenInstance.revokeToAddress(revokeeAccount, revokedToAccount, revokeAmount, { from: ownerAccount }), "RevokerRole: caller does not have the Revoker role")
    await expectRevert(tokenInstance.revokeToAddress(revokeeAccount, revokedToAccount, revokeAmount, { from: whitelistedAccount }), "RevokerRole: caller does not have the Revoker role")
    await expectRevert(tokenInstance.revokeToAddress(revokeeAccount, revokedToAccount, revokeAmount, { from: nonWhitelistedAccount }), "RevokerRole: caller does not have the Revoker role")
  })

  it('should emit event when tokens are revoked', async () => {
    await tokenInstance.addRevoker(adminAccount)

    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = '25'

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // revoke tokens from the user
    const { logs } = await tokenInstance.revokeToAddress(revokeeAccount, revokedToAccount, revokeAmount, { from: adminAccount })

    expectEvent.inLogs(logs, 'RevokeToAddress', { revoker: adminAccount, from: revokeeAccount, to: revokedToAccount, amount: revokeAmount })
  })
})
