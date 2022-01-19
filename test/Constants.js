const BigNumber = require('bignumber.js')

module.exports = {
  name: "Wrapped Token",
  symbol: "WTOK",
  decimals: 18,
  supply: new BigNumber(10).pow(18).multipliedBy(50).multipliedBy(1000000000),

  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  MAX_UINT256: new BigNumber('2').pow(new BigNumber('256')).minus(new BigNumber('1'))
}