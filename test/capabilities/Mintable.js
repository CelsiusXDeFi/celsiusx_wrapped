/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const WrappedTokenV1 = artifacts.require('WrappedTokenV1')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')
const BigNumber = require('bignumber.js')

const MockV3Aggregator = artifacts.require('MockV3Aggregator')

const ERC3156FlashBorrowerMock = artifacts.require('ERC3156FlashBorrowerMock')
const ERC3156FlashBorrowerReentrancy = artifacts.require('ERC3156FlashBorrowerReentrancy')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Mintable', (accounts) => {

  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const minteeAccount = accounts[4]

  let tokenInstance, tokenDeploy, proxyInstance, token;

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
      true);
  })

  it('Owner should be able to mint tokens', async () => {
    // Add minter
    await tokenInstance.addMinter(ownerAccount)

    // set up the amounts to test
    const mintAmount = '100'

    // get initial account balance and token supply
    const initialSupply = await tokenInstance.totalSupply()
    const accountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(0, accountBalance, 'Account should have initial balance of 0')

    // mint tokens
    await tokenInstance.mint(whitelistedAccount, mintAmount)

    // confirm account balance and total supply are updated
    const postMintSupply = await tokenInstance.totalSupply()
    const postMintAccountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(mintAmount, postMintAccountBalance, 'Account balance should equal mint amount post mint')
    assert.equal(new BigNumber(initialSupply).plus(mintAmount).toFixed(), new BigNumber(postMintSupply).toFixed(), 'Total supply post mint should be updated with additional minted amount')
  })

  it('Non-MinterRole accounts should not be able to mint tokens to any account', async () => {
    // set up the amounts to test
    const mintAmount = '100'

    // attempt to mint tokens
    await expectRevert(tokenInstance.mint(minteeAccount, mintAmount, { from: adminAccount }), "MinterRole: caller does not have the Minter role")
  })

  it('should emit event when tokens are minted', async () => {
    // Add minter
    await tokenInstance.addMinter(ownerAccount)

    // set up the amounts to test
    const mintAmount = '100'

    // mint tokens to mintee account
    const { logs } = await tokenInstance.mint(minteeAccount, mintAmount, { from: ownerAccount })

    expectEvent.inLogs(logs, 'Mint', { minter: ownerAccount, to: minteeAccount, amount: mintAmount })
  })

  const [initialHolder, other] = accounts;

  const name = Constants.name;
  const symbol = Constants.symbol;

  const loanAmount = new BigNumber(10000000000000);
  const initialSupply = Constants.supply.multipliedBy(0.01);

  describe('maxFlashLoan', function () {

    it('token match', async function () {

      const expectedMaxFlashLoan = Constants.MAX_UINT256.minus(initialSupply).toFixed();
      const maxFlashLoan = (new BigNumber((await tokenInstance.maxFlashLoan(tokenInstance.address)).toJSON(), 16)).toFixed()

      assert.equal(maxFlashLoan, expectedMaxFlashLoan, 'The max flash loan is not as expected');
    });

    it('token mismatch', async function () {

      const expectedMaxFlashLoan = (new BigNumber(0)).toFixed();
      const maxFlashLoan = (new BigNumber((await tokenInstance.maxFlashLoan(Constants.ZERO_ADDRESS)).toJSON(), 16)).toFixed()

      assert.equal(maxFlashLoan, expectedMaxFlashLoan, 'The max flash loan is not as expected');
    });
  });

  describe('flashFee', function () {
    it('token match', async function () {

      const expectedflashFee = (new BigNumber(0)).toFixed();
      const flashFee = (new BigNumber((await tokenInstance.flashFee(tokenInstance.address, loanAmount)).toJSON(), 16)).toFixed()

      assert.equal(flashFee, expectedflashFee, 'Flash fee is not as expected');
    });

    it('token mismatch', async function () {
      await expectRevert(tokenInstance.flashFee(Constants.ZERO_ADDRESS, loanAmount), 'ERC20FlashMint: wrong token');
    });
  });

  describe('flashLoan', function () {
    it('success', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, true);
      const { tx } = await tokenInstance.flashLoan(receiver.address, tokenInstance.address, loanAmount, '0x');

      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: Constants.ZERO_ADDRESS, to: receiver.address, value: web3.utils.toBN(loanAmount) });
      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: receiver.address, to: Constants.ZERO_ADDRESS, value: web3.utils.toBN(loanAmount) });
      await expectEvent.inTransaction(tx, receiver, 'BalanceOf', { token: tokenInstance.address, account: receiver.address, value: web3.utils.toBN(loanAmount) });
      await expectEvent.inTransaction(tx, receiver, 'TotalSupply', { token: tokenInstance.address, value: web3.utils.toBN(initialSupply.plus(loanAmount).toString(16)) });

      const totalSupply = (new BigNumber((await tokenInstance.totalSupply()).toJSON(), 16)).toFixed();
      const receiverBalance = (new BigNumber((await tokenInstance.balanceOf(receiver.address)).toJSON(), 16)).toFixed();
      const receiverTokenAllowance = (new BigNumber((await tokenInstance.allowance(receiver.address, tokenInstance.address)).toJSON(), 16)).toFixed();

      assert.equal(totalSupply, initialSupply.toFixed(), 'Incorrect total supply');
      assert.equal(receiverBalance, (new BigNumber(0)).toFixed(), 'Incorrect receiver balance');
      assert.equal(receiverTokenAllowance, (new BigNumber(0)).toFixed(), 'Incorrect receiver token allowance');
    });

    it('success flash minting more than the reserve', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, true);
      const { tx } = await tokenInstance.flashLoan(receiver.address, tokenInstance.address, Constants.supply, '0x');

      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: Constants.ZERO_ADDRESS, to: receiver.address, value: web3.utils.toBN(Constants.supply) });
      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: receiver.address, to: Constants.ZERO_ADDRESS, value: web3.utils.toBN(Constants.supply) });
      await expectEvent.inTransaction(tx, receiver, 'BalanceOf', { token: tokenInstance.address, account: receiver.address, value: web3.utils.toBN(Constants.supply) });
      await expectEvent.inTransaction(tx, receiver, 'TotalSupply', { token: tokenInstance.address, value: web3.utils.toBN(initialSupply.plus(Constants.supply).toString(16)) });

      const totalSupply = (new BigNumber((await tokenInstance.totalSupply()).toJSON(), 16)).toFixed();
      const receiverBalance = (new BigNumber((await tokenInstance.balanceOf(receiver.address)).toJSON(), 16)).toFixed();
      const receiverTokenAllowance = (new BigNumber((await tokenInstance.allowance(receiver.address, tokenInstance.address)).toJSON(), 16)).toFixed();

      assert.equal(totalSupply, initialSupply.toFixed(), 'Incorrect total supply');
      assert.equal(receiverBalance, (new BigNumber(0)).toFixed(), 'Incorrect receiver balance');
      assert.equal(receiverTokenAllowance, (new BigNumber(0)).toFixed(), 'Incorrect receiver token allowance');
    });

    it('fee to minter', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, true);

      await tokenInstance.addMinter(ownerAccount);
      await tokenInstance.setFlashMintFee(new BigNumber(2));

      await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount });

      await tokenInstance.addToWhitelist(ownerAccount, 1, { from: adminAccount });
      await tokenInstance.addToWhitelist(receiver.address, 1, { from: adminAccount });

      await tokenInstance.updateOutboundWhitelistEnabled(1, 1, true, { from: adminAccount });

      await tokenInstance.transfer(receiver.address, new BigNumber(2));

      const initialOwnerBalance = new BigNumber(await tokenInstance.balanceOf(ownerAccount));
      const { tx } = await tokenInstance.flashLoan(receiver.address, tokenInstance.address, loanAmount, '0x');

      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: Constants.ZERO_ADDRESS, to: receiver.address, value: web3.utils.toBN(loanAmount) });
      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: receiver.address, to: ownerAccount, value: web3.utils.toBN(new BigNumber(2)) });
      await expectEvent.inTransaction(tx, tokenInstance, 'Transfer', { from: receiver.address, to: Constants.ZERO_ADDRESS, value: web3.utils.toBN(loanAmount) });
      await expectEvent.inTransaction(tx, receiver, 'BalanceOf', { token: tokenInstance.address, account: receiver.address, value: web3.utils.toBN(loanAmount.plus(2)) });
      await expectEvent.inTransaction(tx, receiver, 'TotalSupply', { token: tokenInstance.address, value: web3.utils.toBN(initialSupply.plus(loanAmount).toString(16)) });

      const totalSupply = (new BigNumber((await tokenInstance.totalSupply()).toJSON(), 16)).toFixed();
      const receiverBalance = (new BigNumber((await tokenInstance.balanceOf(receiver.address)).toJSON(), 16)).toFixed();
      const receiverTokenAllowance = (new BigNumber((await tokenInstance.allowance(receiver.address, tokenInstance.address)).toJSON(), 16)).toFixed();

      assert.equal(totalSupply, initialSupply.toFixed(), 'Incorrect total supply');
      assert.equal(receiverBalance, (new BigNumber(0)).toFixed(), 'Incorrect receiver balance');
      assert.equal(receiverTokenAllowance, (new BigNumber(0)).toFixed(), 'Incorrect receiver token allowance');
      assert.equal((new BigNumber(await tokenInstance.balanceOf(ownerAccount))).toFixed(), initialOwnerBalance.plus(2).toFixed(), 'Incorrect owner balance');
    });

    it('missing return value', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(false, true);
      await expectRevert(
        tokenInstance.flashLoan(receiver.address, tokenInstance.address, loanAmount, '0x'),
        'ERC20FlashMint: invalid return value',
      );
    });

    it('missing approval', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, false);
      await expectRevert(
        tokenInstance.flashLoan(receiver.address, tokenInstance.address, loanAmount, '0x'),
        'ERC20FlashMint: allowance does not allow refund',
      );
    });

    it('unavailable funds', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, true);

      await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount });

      await tokenInstance.addToWhitelist(other, 1, { from: adminAccount });
      await tokenInstance.addToWhitelist(receiver.address, 1, { from: adminAccount });

      await tokenInstance.updateOutboundWhitelistEnabled(1, 1, true, { from: adminAccount });

      const data = tokenInstance.contract.methods.transfer(other, 10).encodeABI();
      await expectRevert(
        tokenInstance.flashLoan(receiver.address, tokenInstance.address, loanAmount, data),
        'ERC20: burn amount exceeds balance',
      );
    });

    it('more than maxFlashLoan', async function () {

      const receiver = await ERC3156FlashBorrowerMock.new(true, true);
      const data = tokenInstance.contract.methods.transfer(other, 10).encodeABI();
      // _mint overflow reverts using a panic code. No reason string.
      await expectRevert.unspecified(tokenInstance.flashLoan(receiver.address, tokenInstance.address, Constants.MAX_UINT256, data));
    });

    it('reentrancy guard', async function () {
      const receiver = await ERC3156FlashBorrowerReentrancy.new();
      await expectRevert(tokenInstance.flashLoan(receiver.address, tokenInstance.address, Constants.supply, '0x'), 'ReentrancyGuard: reentrant call');
    });
  });
})
