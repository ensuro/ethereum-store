import { getEncodedCallFn } from "../../package-index";

import {
  ETH_CALL,
  ETH_CALL_FAIL,
  ETH_CALL_SUCCESS,
  ETH_ADD_SUBSCRIPTION,
  ETH_REMOVE_SUBSCRIPTION,
  SET_TIMESTAMP_TO_REFRESH,
  ETH_TRANSACT,
  ETH_TRANSACT_QUEUED,
  ETH_TRANSACT_REJECTED,
  ETH_TRANSACT_MINED,
  ETH_TRANSACT_REVERTED,
  ETH_TRANSACT_EXPIRED,
  ETH_EIP_712_SIGN,
  ETH_EIP_712_SIGN_FAILED,
  ETH_EIP_712_SIGN_PROCESSED,
  ETH_SIWE_SIGN,
  ETH_SIWE_SIGN_FAILED,
  ETH_SIWE_SIGN_PROCESSED,
  SET_ETH_SIWE_SIGN,
  ETH_PLAIN_SIGN,
  ETH_PLAIN_SIGN_PROCESSED,
  ETH_PLAIN_SIGN_FAILED,
  SET_USER_CURRENT_CHAIN,
} from "./actionTypes";

const { ethers } = require("ethers");
const INIT_STATE = {
  timestamp: 0,
  currentChain: { name: "Mumbai", id: 80001, rpc: "https://rpc.ankr.com/polygon_mumbai" },
  chainState: {
    /*
     * <chainId>: {
     *    calls: { "0xsfsdf"_getBalance(nicolas): {
     *      <address>_<encodedCall>: {
     *          state: "LOADING|LOADED|ERROR",
     *          value: <decodedValue>,
     *          retries: undefined | number
     *      }
     *    }
     *    // Different dictionary to avoid re-rendering if only timestamp changes
     *    call_metadata: {
     *        call_key>: {timestamp: <timestamp-with-milisecs>}
     *    },
     *    subscriptions: {
     *        <component_key>: [ ETH call list ]
     *    },
     *    transacts: [],
     *    signs: {},
     *    siweSigns: {},
     *    eipSigns: {},
     */
  },
};

function modifyNode(state, path, newValueFn) {
  if (path.length === 1) return { ...state, [path[0]]: newValueFn(state[path[0]] || {}) };
  else {
    return { ...state, [path[0]]: modifyNode(state[path[0]] || {}, path.slice(1, path.length), newValueFn) };
  }
}

const EthereumReducer = (state = INIT_STATE, action) => {
  let chainId;
  switch (action.type) {
    case ETH_CALL:
      chainId = state.currentChain.id;
      let rpc = state.currentChain.rpc;
      let key = action.address + "_" + getEncodedCallFn(action.address, action.abi, action.method, action.args, rpc);
      state = modifyNode(state, ["chainState", chainId, "calls", key], (call) => {
        call = call || {};
        call.state = call.state !== "LOADED" ? "LOADING" : call.state;
        if (action.retry !== undefined) call.retries = action.retry;
        return call;
      });
      break;

    case ETH_CALL_SUCCESS:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "call_metadata", action.call_key], () => {
        return { timestamp: action.timestamp };
      });
      state = modifyNode(state, ["chainState", chainId, "calls", action.call_key], () => {
        return { state: "LOADED", value: action.value };
      });
      break;

    case ETH_CALL_FAIL:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "calls", action.call_key], (x) => {
        return { ...x, state: "ERROR" };
      });
      break;

    case ETH_ADD_SUBSCRIPTION:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "subscriptions", action.key], () => action.componentEthCalls);
      break;

    case ETH_REMOVE_SUBSCRIPTION:
      let newChainState = { ...state.chainState };
      delete newChainState[state.currentChain.id]?.subscriptions[action.key];
      state = { ...state, chainState: newChainState };
      break;

    case SET_TIMESTAMP_TO_REFRESH:
      state = { ...state, timestamp: action.timestamp };
      break;

    case ETH_TRANSACT:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId], (x) => {
        x.transacts = [...(x.transacts || []), { address: action.address, method: action.method, args: action.args }];
        return x;
      });
      break;

    case ETH_TRANSACT_QUEUED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "transacts"], (transacts) => {
        return (transacts || []).with(action.id, { ...transacts[action.id], txHash: action.txHash, state: "QUEUED" });
      });

      break;

    case ETH_TRANSACT_REJECTED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "transacts"], (transacts) => {
        return (transacts || []).with(action.id, { ...transacts[action.id], error: action.payload, state: "REJECTED" });
      });
      break;

    case ETH_TRANSACT_MINED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "transacts"], (transacts) => {
        return (transacts || []).with(action.id, { ...transacts[action.id], state: "MINED" });
      });
      break;

    case ETH_TRANSACT_REVERTED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "transacts"], (transacts) => {
        return (transacts || []).with(action.id, { ...transacts[action.id], state: "REVERTED" });
      });
      break;

    case ETH_TRANSACT_EXPIRED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "transacts"], (transacts) => {
        return (transacts || []).with(action.id, { ...transacts[action.id], state: "EXPIRED" });
      });
      break;

    case ETH_SIWE_SIGN:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "siweSigns", action.userAddress], () => {
        return { state: "PENDING" };
      });
      break;

    case SET_ETH_SIWE_SIGN:
    case ETH_SIWE_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "siweSigns", action.key], () => {
        return {
          state: "SIGNED",
          signature: action.signature,
          message: action.message,
          email: action.email,
          country: action.country,
          occupation: action.occupation,
          whitelist: action.whitelist,
        };
      });
      break;

    case ETH_SIWE_SIGN_FAILED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "siweSigns", action.key], (x) => {
        return { ...x, state: "ERROR", error: action.payload };
      });
      break;

    case ETH_EIP_712_SIGN:
      chainId = state.currentChain.id;
      const eipKey = ethers.TypedDataEncoder.encode(action.domain, action.types, action.value);
      state = modifyNode(state, ["chainState", chainId, "eipSigns", eipKey], () => {
        return { state: "PENDING" };
      });
      break;

    case ETH_EIP_712_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "eipSigns", action.key], () => {
        return {
          state: "SIGNED",
          userAddress: action.userAddress,
          signature: action.signature,
          domain: action.domain,
          types: action.types,
          value: action.value,
        };
      });
      break;

    case ETH_EIP_712_SIGN_FAILED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "eipSigns", action.key], (x) => {
        return { ...x, state: "ERROR", error: action.payload, userAddress: action.userAddress };
      });
      break;

    case ETH_PLAIN_SIGN:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "signs", action.userAddress], () => {
        return { state: "PENDING" };
      });
      break;

    case ETH_PLAIN_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "signs", action.key], () => {
        return {
          state: "SIGNED",
          signature: action.signature,
          message: action.message,
        };
      });
      break;

    case ETH_PLAIN_SIGN_FAILED:
      chainId = state.currentChain.id;
      state = modifyNode(state, ["chainState", chainId, "signs", action.key], (x) => {
        return { ...x, state: "ERROR", error: action.payload };
      });
      break;

    case SET_USER_CURRENT_CHAIN:
      state = { ...state, currentChain: { name: action.name, id: action.id, rpc: action.rpc } };
      break;

    default:
      state = { ...state };
      break;
  }
  return state;
};

export default EthereumReducer;
