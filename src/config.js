const env =
  (typeof import.meta !== "undefined" && import.meta.env) || (typeof process !== "undefined" && process.env) || {};

export default {
  ethereum: {
    retry: {
      timeout: parseInt(env.VITE_API_RETRY_TIMEOUT || 500, 10),
      count: parseInt(env.VITE_API_RETRY_COUNT || 10, 10),
      transactCount: parseInt(env.VITE_API_ETH_TRANSACT_COUNT || 300),
    },
    defaultMaxAge: parseInt(env.VITE_API_DEFAULT_MAX_AGE || 3000, 10),
  },
  gas: {
    increase: 130, // 30%
  },
};
