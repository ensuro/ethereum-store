# Ethereum-store

Ethereum store for react redux

# How to use

## Install

```bash
npm install --save ethereum-store
```

## Configure

### Add the reducer

In the `reducers.js` file:

```js
import EthereumReducer from "ethereum-store/src/store/ethereum/reducer";

export default combineReducers({
  // ...
  EthereumReducer,
});
```

### Add the saga

In the `sagas.js` file:

```js
import { ethereumSaga, initializeEthereumStore } from "ethereum-store/src/package-index";

const clockCount = 15;
initializeEthereumStore({
  getEncodedCall,
  getContract,
  getAbiName,
  getABI,
  getFormatter,
  getSignerContract,
  getTxReceiptStatus,
  selectUserAddress,
  selectChainId,
  selectProvider,
  chain,
  clockCount, // clockCount is the amount of times an ETH_CALL will be skipped - default is 10
});

export default function* rootSaga() {
  yield all([
    // ...
    fork(ethereumSaga),
  ]);
}
```

### Add the dispatch clock

In the `App.js` add this `useEffect` to dispatch the clock every Xms.
This clock will dispatch an action in the saga every Xms and that action will call the blockchain.

```js
useEffect(() => {
  const interval = setInterval(() => {
    dispatch({ type: "ETH_DISPATCH_CLOCK" });
  }, 500);
  return () => clearInterval(interval);
}, [dispatch]);
```

# Actions

```js
/** Ethereum Calls */
/**
 * {type: ETH_CALL, address: eToken.address, abi: "EToken", method: "totalSupply", args: []}
 * {type: ETH_CALL, address: usdc.address, abi: "ERC20Permit", method: "balanceOf", args: [user.address]}
 */
export const ETH_CALL = "ETH_CALL";

/**
 * {type: ETH_CALL_SUCCESS, call_key: "0x...", method: "totalSupply", args: []}
 */
export const ETH_CALL_SUCCESS = "ETH_CALL_SUCCESS";

/**
 * {type: ETH_CALL_FAIL, call_key: "0x...", payload: "error message" }
 */
export const ETH_CALL_FAIL = "ETH_CALL_FAIL";

/**
 * {type: ETH_ADD_SUBSCRIPTION, key: "positions", componentEthCalls: [{address: "0x...", abi: "AavePool", method: "getUserAccountData", args: [user.address]}]}
 */
export const ETH_ADD_SUBSCRIPTION = "ETH_ADD_SUBSCRIPTION";

/**
 * {type: ETH_REMOVE_SUBSCRIPTION, key: "positions" }
 */
export const ETH_REMOVE_SUBSCRIPTION = "ETH_REMOVE_SUBSCRIPTION";

/**
 * ETH_SUBSCRIPTION_INCREASE_CLOCK -> This action sets when to call each subscription again
 */
export const ETH_SUBSCRIPTION_INCREASE_CLOCK = "ETH_SUBSCRIPTION_INCREASE_CLOCK";

/**
 * ETH_INCREASE_CLOCK -> Increase the general clock to check if the saga should call the blockchain again
 */
export const ETH_INCREASE_CLOCK = "ETH_INCREASE_CLOCK";

/**
 * ETH_DISPATCH_CLOCK -> This clock will dispatch an action in the saga every Xms and that action will call the blockchain.
 */
export const ETH_DISPATCH_CLOCK = "ETH_DISPATCH_CLOCK";

/** Ethereum Transactions */
/**
 * {type: ETH_TRANSACT, address: "0x...", method: "approve", abi: "ERC20Permit" args: []}
 */
export const ETH_TRANSACT = "ETH_TRANSACT";

/**
 * {type: ETH_TRANSACT_QUEUED, id: 0, txHash: "0x..." }
 */
export const ETH_TRANSACT_QUEUED = "ETH_TRANSACT_QUEUED";

/**
 * {type: ETH_TRANSACT_REJECTED, id: 0, error: error.message }
 */
export const ETH_TRANSACT_REJECTED = "ETH_TRANSACT_REJECTED";

/**
 * {type: ETH_TRANSACT_MINED, id:  0}
 */
export const ETH_TRANSACT_MINED = "ETH_TRANSACT_MINED";

/**
 * {type: ETH_TRANSACT_REVERTED, id: 0 }
 */
export const ETH_TRANSACT_REVERTED = "ETH_TRANSACT_REVERTED";

/**
 * {type: ETH_TRANSACT_EXPIRED, id: 0 }
 */
export const ETH_TRANSACT_EXPIRED = "ETH_TRANSACT_EXPIRED";

/**
 * ETH Sign
 * ERC-2612: Permit Extension for EIP-20 Signed Approvals
 * https://eips.ethereum.org/EIPS/eip-2612
 */

/**
 * {type: ETH_EIP_712_SIGN, key: encode(domain, types, value),  state: "PENDING" }
 */
export const ETH_EIP_712_SIGN = "ETH_EIP_712_SIGN";

/**
 * {type: ETH_EIP_712_SIGN_PROCESSED, key: encode(domain, types, value), signature: "0x1234...", userAddress: "0x...", spender: pool.address, amount: amount, deadline: 1234, nonce: 1}
 */
export const ETH_EIP_712_SIGN_PROCESSED = "ETH_EIP_712_SIGN_PROCESSED";

/**
 * {type: ETH_EIP_712_SIGN_FAILED, key: encode(domain, types, value), payload: error.message  }
 */
export const ETH_EIP_712_SIGN_FAILED = "ETH_EIP_712_SIGN_FAILED";

/**
 * {type: ETH_PLAIN_SIGN, key: "key", message: "Welcome! By signing, you agree to the Terms of Service.", userAddress: "0x..", nextAction?: {} }
 */
export const ETH_PLAIN_SIGN = "ETH_PLAIN_SIGN";

/**
 * {type: ETH_PLAIN_SIGN_PROCESSED, key: "key", userAddress: "0x..", signature: "0x1234...", message: "message to sign"}
 */
export const ETH_PLAIN_SIGN_PROCESSED = "ETH_PLAIN_SIGN_PROCESSED";

/**
 * {type: ETH_PLAIN_SIGN_FAILED, key: "key", payload: error.message  }
 */
export const ETH_PLAIN_SIGN_FAILED = "ETH_PLAIN_SIGN_FAILED";

/**
 * {type: SET_USER_CURRENT_CHAIN, name: "Sepolia", id: 11155111, rpc: rpcUrl  }
 */
export const SET_USER_CURRENT_CHAIN = "SET_USER_CURRENT_CHAIN";
```
