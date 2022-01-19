/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const WrappedTokenV1 = artifacts.require('WrappedTokenV1')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

const MockV3Aggregator = artifacts.require('MockV3Aggregator')

/**
 * Sanity checks for managing the Blacklister Role
 */
contract('BlacklisterRole', (accounts) => {

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

  it('should allow an owner to add/remove Blacklisters', async () => {
    // Should start out as false
    let isBlacklister1 = await tokenInstance.isBlacklister(accounts[1])
    assert.equal(isBlacklister1, false, 'Account 1 should not be a Blacklister by default')

    // Add it and verify
    await tokenInstance.addBlacklister(accounts[1])
    isBlacklister1 = await tokenInstance.isBlacklister(accounts[1])
    assert.equal(isBlacklister1, true, 'Account 1 should be a Blacklister')

    // Remove it and verify
    await tokenInstance.removeBlacklister(accounts[1])
    isBlacklister1 = await tokenInstance.isBlacklister(accounts[1])
    assert.equal(isBlacklister1, false, 'Account 1 should not be a Blacklister')
  })

  it('should not allow a non owner to add/remove Blacklisters', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addBlacklister(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Add it with owner
    await tokenInstance.addBlacklister(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeBlacklister(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeBlacklister(accounts[4])
  })

  it('should emit events for adding Blacklisters', async () => {
    const { logs } = await tokenInstance.addBlacklister(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'BlacklisterAdded', { addedBlacklister: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing Blacklisters', async () => {
    await tokenInstance.addBlacklister(accounts[3])
    const { logs } = await tokenInstance.removeBlacklister(accounts[3])

    expectEvent.inLogs(logs, 'BlacklisterRemoved', { removedBlacklister: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {
    // Add it
    await tokenInstance.addBlacklister(accounts[0])
    let isBlacklister1 = await tokenInstance.isBlacklister(accounts[0])
    assert.equal(isBlacklister1, true, 'Account 0 should be a Blacklister')

    // Remove it 
    await tokenInstance.removeBlacklister(accounts[0])
    isBlacklister1 = await tokenInstance.isBlacklister(accounts[0])
    assert.equal(isBlacklister1, false, 'Account 0 should not be a Blacklister')
  })
})
