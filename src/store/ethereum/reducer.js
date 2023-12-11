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
  transacts: [],
  currentChain: { name: "Mumbai", id: 80001 },
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

const getChainStateByKey = (state, key, chainId) => {
  let calls = { ...state.chainState };
  calls[chainId] = calls[chainId] ? { ...calls[chainId] } : {};
  calls[chainId][key] = calls[chainId][key] ? { ...calls[chainId][key] } : {};
  return calls;
};

const EthereumReducer = (state = INIT_STATE, action) => {
  let chainId;
  switch (action.type) {
    case ETH_CALL:
      chainId = state.currentChain.id;
      let key = action.address + "_" + getEncodedCallFn(action.address, action.abi, action.method, action.args);
      let calls = getChainStateByKey(state, "calls", chainId);
      calls[chainId].calls[key] = calls[chainId].calls[key] ? { ...calls[chainId].calls[key] } : {};
      if (calls[chainId].calls[key].state !== "LOADED")
        calls[chainId].calls[key].state =
          calls[chainId].calls[key].state !== "LOADED" ? "LOADING" : calls[chainId].calls[key].state;
      if (action.retry !== undefined) calls[chainId].calls[key].retries = action.retry;
      state = { ...state, chainState: calls };
      break;

    case ETH_CALL_SUCCESS:
      chainId = state.currentChain.id;
      let newCalls = getChainStateByKey(state, "calls", chainId);
      newCalls[chainId].call_metadata = { ...(newCalls[chainId].call_metadata || {}) };
      newCalls[chainId].calls[action.call_key] = { state: "LOADED", value: action.value };
      newCalls[chainId].call_metadata[action.call_key] = { timestamp: action.timestamp };
      state = { ...state, chainState: newCalls };
      break;

    case ETH_CALL_FAIL:
      chainId = state.currentChain.id;
      let failCalls = getChainStateByKey(state, "calls", chainId);
      failCalls[chainId].calls[action.call_key] = { state: "ERROR" };
      state = { ...state, chainState: failCalls };
      break;

    case ETH_ADD_SUBSCRIPTION:
      chainId = state.currentChain.id;
      let subs = getChainStateByKey(state, "subscriptions", chainId);
      subs[chainId].subscriptions[action.key] = action.componentEthCalls;
      state = { ...state, chainState: subs };
      break;

    case ETH_REMOVE_SUBSCRIPTION:
      let newChainState = { ...state.chainState };
      delete newChainState[state.currentChain.id].subscriptions[action.key];
      state = { ...state, chainState: newChainState };
      break;

    case SET_TIMESTAMP_TO_REFRESH:
      state = { ...state, timestamp: action.timestamp };
      break;

    case ETH_TRANSACT:
      state = {
        ...state,
        transacts: [...state.transacts, { address: action.address, method: action.method, args: action.args }],
      };
      break;

    case ETH_TRANSACT_QUEUED:
      let newTransacts = [...state.transacts];
      newTransacts[action.id] = { ...newTransacts[action.id], txHash: action.txHash, state: "QUEUED" };
      state = { ...state, transacts: newTransacts };

      break;

    case ETH_TRANSACT_REJECTED:
      let transactWithError = [...state.transacts];
      transactWithError[action.id] = { ...transactWithError[action.id], error: action.payload, state: "REJECTED" };
      state = { ...state, transacts: transactWithError };

      break;

    case ETH_TRANSACT_MINED:
      let transactMined = [...state.transacts];
      transactMined[action.id] = { ...transactMined[action.id], state: "MINED" };
      state = { ...state, transacts: transactMined };

      break;

    case ETH_TRANSACT_REVERTED:
      let transactRejected = [...state.transacts];
      transactRejected[action.id] = { ...transactRejected[action.id], state: "REVERTED" };
      state = { ...state, transacts: transactRejected };
      break;

    case ETH_TRANSACT_EXPIRED:
      let transactExpired = [...state.transacts];
      transactExpired[action.id] = { ...transactExpired[action.id], state: "EXPIRED" };
      state = { ...state, transacts: transactExpired };
      break;

    case ETH_SIWE_SIGN:
      chainId = state.currentChain.id;
      let signs = getChainStateByKey(state, "siweSigns", chainId);
      signs[chainId].siweSigns[action.userAddress] = { state: "PENDING" };
      state = { ...state, chainState: signs };
      break;

    case SET_ETH_SIWE_SIGN:
    case ETH_SIWE_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      let fullSigns = getChainStateByKey(state, "siweSigns", chainId);
      fullSigns[chainId].siweSigns[action.userAddress] = {
        state: "SIGNED",
        signature: action.signature,
        message: action.message,
        email: action.email,
        country: action.country,
        occupation: action.occupation,
        whitelist: action.whitelist,
      };
      state = { ...state, chainState: fullSigns };
      break;

    case ETH_SIWE_SIGN_FAILED:
      chainId = state.currentChain.id;
      let siweFailed = getChainStateByKey(state, "siweSigns", chainId);
      siweFailed[chainId].siweSigns[action.key] = {
        ...siweFailed[chainId].siweSigns[action.key],
        state: "ERROR",
        error: action.payload,
      };
      state = { ...state, chainState: siweFailed };
      break;

    case ETH_EIP_712_SIGN:
      chainId = state.currentChain.id;
      const eipKey = ethers.utils._TypedDataEncoder.encode(action.domain, action.types, action.value);

      let eip712 = getChainStateByKey(state, "eipSigns", chainId);
      eip712[chainId].eipSigns[eipKey] = { state: "PENDING" };
      state = { ...state, chainState: eip712 };
      break;

    case ETH_EIP_712_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      let eipSigned = getChainStateByKey(state, "eipSigns", chainId);
      eipSigned[chainId].eipSigns[action.key] = {
        state: "SIGNED",
        userAddress: action.userAddress,
        signature: action.signature,
        domain: action.domain,
        types: action.types,
        value: action.value,
      };
      state = { ...state, chainState: eipSigned };
      break;

    case ETH_EIP_712_SIGN_FAILED:
      chainId = state.currentChain.id;
      let failed = getChainStateByKey(state, "eipSigns", chainId);
      failed[chainId].eipSigns[action.key] = {
        ...failed[chainId].eipSigns[action.key],
        state: "ERROR",
        error: action.payload,
        userAddress: action.userAddress,
      };
      state = { ...state, chainState: failed };
      break;

    case ETH_PLAIN_SIGN:
      chainId = state.currentChain.id;
      let plainSigns = getChainStateByKey(state, "signs", chainId);
      plainSigns[chainId].signs[action.userAddress] = { state: "PENDING" };
      state = { ...state, chainState: plainSigns };
      break;

    case ETH_PLAIN_SIGN_PROCESSED:
      chainId = state.currentChain.id;
      let fullPlainSigns = getChainStateByKey(state, "signs", chainId);
      fullPlainSigns[chainId].signs[action.key] = {
        state: "SIGNED",
        signature: action.signature,
        message: action.message,
      };
      state = { ...state, chainState: fullPlainSigns };
      break;

    case ETH_PLAIN_SIGN_FAILED:
      chainId = state.currentChain.id;
      let plainFail = getChainStateByKey(state, "signs", chainId);
      plainFail[chainId].signs[action.key] = {
        ...plainFail[chainId].signs[action.key],
        state: "ERROR",
        error: action.payload,
      };
      state = { ...state, chainState: plainFail };
      break;

    case SET_USER_CURRENT_CHAIN:
      state = { ...state, currentChain: { name: action.name, id: action.id } };
      break;

    default:
      state = { ...state };
      break;
  }
  return state;
};

export default EthereumReducer;
