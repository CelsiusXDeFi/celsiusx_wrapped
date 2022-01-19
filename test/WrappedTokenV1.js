/* global artifacts contract it assert */
const { expectRevert } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

const Proxy = artifacts.require('Proxy');
const WrappedTokenV1 = artifacts.require('WrappedTokenV1');

const Constants = require('./Constants');
const BigNumber = require('bignumber.js');

const ERC20Mock = artifacts.require('ERC20Mock');
const MockV3Aggregator = artifacts.require('MockV3Aggregator');

const Sender = artifacts.require('Sender');

contract('WrappedTokenV1', (accounts) => {

  let tokenInstance, tokenDeploy, proxyInstance, mockReserveFeed;

  beforeEach(async () => {

    mockReserveFeed = await MockV3Aggregator.new(Constants.decimals, Constants.supply);
    tokenDeploy = await WrappedTokenV1.new(Constants.name, Constants.symbol, mockReserveFeed.address);

    proxyInstance = await Proxy.new(tokenDeploy.address);
    tokenInstance = await WrappedTokenV1.at(proxyInstance.address);

    await tokenInstance.initialize(
      accounts[0],
      Constants.name,
      Constants.symbol,
      Constants.supply.multipliedBy(0.01),
      mockReserveFeed.address,
      true,
      false);
  });

  it('should deploy', async () => {
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed');
  });

  it('should not allow a 0x0 address in setting proxy', async () => {
    await expectRevert(Proxy.new("0x0000000000000000000000000000000000000000"), "Contract Logic cannot be 0x0");
  });

  it('should have correct details set', async () => {
    assert.equal(await tokenInstance.name.call(), Constants.name, 'Name should be set correctly');
    assert.equal(await tokenInstance.symbol.call(), Constants.symbol, 'Symbol should be set correctly');
    assert.equal(await tokenInstance.decimals.call(), Constants.decimals, 'Decimals should be set correctly');
  });

  it('should initialize for oracle without matching decimals', async () => {

    let newMockReserveFeed = await MockV3Aggregator.new(8, new BigNumber(10).pow(8).multipliedBy(50).multipliedBy(1000000000));
    let newTokenDeploy = await WrappedTokenV1.new(Constants.name, Constants.symbol, mockReserveFeed.address);

    let newProxyInstance = await Proxy.new(newTokenDeploy.address);
    let newTokenInstance = await WrappedTokenV1.at(newProxyInstance.address);

    await newTokenInstance.initialize(
      accounts[1],
      Constants.name,
      Constants.symbol,
      Constants.supply.multipliedBy(0.01),
      newMockReserveFeed.address,
      true,
      false);

    assert.equal(await newTokenInstance.name.call(), Constants.name, 'Name should be set correctly');
    assert.equal(await newTokenInstance.symbol.call(), Constants.symbol, 'Symbol should be set correctly');
    assert.equal(await newTokenInstance.decimals.call(), Constants.decimals, 'Decimals should be set correctly');
  });

  it('should mint tokens to owner', async () => {
    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = Constants.supply.multipliedBy(0.01);
    const creatorBalance = new BigNumber(await tokenInstance.balanceOf(accounts[0]));

    // Verify the creator got all the coins
    assert.equal(creatorBalance.toFixed(), expectedSupply.toFixed(), 'Creator should have 50 Billion tokens (including decimals)');

    // Verify some other random accounts for kicks
    const bad1Balance = new BigNumber(await tokenInstance.balanceOf(accounts[1]));
    const bad2Balance = new BigNumber(await tokenInstance.balanceOf(accounts[2]));
    const bad3Balance = new BigNumber(await tokenInstance.balanceOf(accounts[3]));
    assert.equal(bad1Balance.toFixed(), '0', 'Other accounts should have 0 coins');
    assert.equal(bad2Balance.toFixed(), '0', 'Other accounts should have 0 coins');
    assert.equal(bad3Balance.toFixed(), '0', 'Other accounts should have 0 coins');
  });

  it('should mint tokens to different owner', async () => {

    tokenDeploy = await WrappedTokenV1.new(Constants.name, Constants.symbol, mockReserveFeed.address);

    proxyInstance = await Proxy.new(tokenDeploy.address);
    tokenInstance = await WrappedTokenV1.at(proxyInstance.address);

    await tokenInstance.initialize(
      accounts[1],
      Constants.name,
      Constants.symbol,
      Constants.supply.multipliedBy(0.01),
      mockReserveFeed.address,
      true,
      false);

    await tokenInstance.addMinter(accounts[1], { from: accounts[1] });
    await tokenInstance.mint(accounts[1], Constants.supply.multipliedBy(0.01), { from: accounts[1] });

    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = Constants.supply.multipliedBy(0.02);
    const creatorBalance = new BigNumber(await tokenInstance.balanceOf(accounts[1]));

    // Verify the creator got all the coins
    assert.equal(creatorBalance.toFixed(), expectedSupply.toFixed(), 'Owner should have 50 Billion tokens (including decimals)');

    // Verify some other random accounts for kicks
    const bad1Balance = new BigNumber(await tokenInstance.balanceOf(accounts[0]));
    const bad2Balance = new BigNumber(await tokenInstance.balanceOf(accounts[2]));
    const bad3Balance = new BigNumber(await tokenInstance.balanceOf(accounts[3]));
    assert.equal(bad1Balance.toFixed(), '0', 'Other accounts should have 0 coins');
    assert.equal(bad2Balance.toFixed(), '0', 'Other accounts should have 0 coins');
    assert.equal(bad3Balance.toFixed(), '0', 'Other accounts should have 0 coins');
  });

  it('should mint with reserve', async () => {

    await tokenInstance.addMinter(accounts[0]);
    await tokenInstance.mint(accounts[0], 2);

    await expectRevert(tokenInstance.mint(accounts[1], Constants.supply), 'reserve must exceed the total supply');

    const expectedTotalSupply = Constants.supply.multipliedBy(0.01).plus(2).toFixed();
    const totalSupply = (new BigNumber((await tokenInstance.totalSupply()).toJSON(), 16)).toFixed();

    assert.equal(totalSupply, expectedTotalSupply, 'The number of minted tokens is incorrect');
  });

  it('should prevent oracle update without sufficient reserve', async () => {

    await tokenInstance.addMinter(accounts[0]);
    await tokenInstance.mint(accounts[0], 2);

    await expectRevert(tokenInstance.mint(accounts[1], Constants.supply), 'reserve must exceed the total supply');

    const totalSupply = new BigNumber((await tokenInstance.totalSupply()).toJSON(), 16);
    const expectedTotalSupply = Constants.supply.multipliedBy(0.01).plus(2).toFixed();

    assert.equal(totalSupply.toFixed(), expectedTotalSupply, 'The number of minted tokens is incorrect');

    let newMockReserveFeed = await MockV3Aggregator.new(Constants.decimals, totalSupply.minus(1));
    await expectRevert(tokenInstance.updateOracleAddress(newMockReserveFeed.address), 'reserve must exceed the total supply');
  });

  it('should recover any ERC20 token to an owner', async () => {

    let transferAmount;
    let initialTokenSupply;

    mockTokenInstance = await ERC20Mock.new(new BigNumber(1428));

    transferAmount = new BigNumber(634);
    initialTokenSupply = new BigNumber(await mockTokenInstance.balanceOf(accounts[0]));

    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(accounts[0]))).toFixed(), initialTokenSupply.toFixed(), 'Holder has the wrong number of tokens');
    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(tokenInstance.address))).toFixed(), (new BigNumber(0)).toFixed(), 'Wrapped has the wrong number of tokens');

    await mockTokenInstance.transfer(tokenInstance.address, transferAmount);

    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(accounts[0]))).toFixed(), (new BigNumber(794)).toFixed(), 'Holder has the wrong number of tokens');
    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(tokenInstance.address))).toFixed(), transferAmount.toFixed(), 'Wrapped has the wrong number of tokens');

    await tokenInstance.recover(mockTokenInstance.address);

    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(accounts[0]))).toFixed(), initialTokenSupply.toFixed(), 'Holder has the wrong number of tokens');
    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(tokenInstance.address))).toFixed(), (new BigNumber(0)).toFixed(), 'Wrapped has the wrong number of tokens');

    transferAmount = Constants.supply.multipliedBy(0.001);
    initialTokenSupply = new BigNumber(await tokenInstance.balanceOf(accounts[0]));

    await tokenInstance.transfer(tokenInstance.address, transferAmount);

    assert.equal((new BigNumber(await tokenInstance.balanceOf(accounts[0]))).toFixed(), initialTokenSupply.minus(transferAmount).toFixed(), 'Holder has the wrong number of tokens');
    assert.equal((new BigNumber(await mockTokenInstance.balanceOf(tokenInstance.address))).toFixed(), (new BigNumber(0)).toFixed(), 'Wrapped has the wrong number of tokens');
  });

  it('should recover any ETH to an owner', async () => {

    let senderInstance;

    senderInstance = await Sender.new();

    await web3.eth.sendTransaction({ from: accounts[0], to: senderInstance.address, value: 10000000000000000 });
    await expectRevert.unspecified(web3.eth.sendTransaction({ from: accounts[0], to: tokenInstance.address, value: 10000000000000000 }));

    await senderInstance.send(tokenInstance.address);
    assert.isAbove((new BigNumber(await web3.eth.getBalance(tokenInstance.address))).toNumber(), 0, 'Wrapped should have an ETH balance');

    await tokenInstance.withdraw();
    assert.equal(await web3.eth.getBalance(tokenInstance.address), 0, 'Wrapped should not have an ETH balance');
  });
})