module.exports = {
  ethereum: {
    retry: {
      timeout: parseInt(process.env.REACT_APP_ETH_RETRY_TIMEOUT || 500),
      count: parseInt(process.env.REACT_APP_ETH_RETRY_COUNT || 10),
      transactCount: parseInt(process.env.REACT_APP_ETH_TRANSACT_COUNT || 300),
    },
    defaultMaxAge: parseInt(process.env.REACT_APP_ETH_DEFAULT_MAX_AGE || 3000),
  },
  gas: {
    increase: 130, // 30%
  },
};
