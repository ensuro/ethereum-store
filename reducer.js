import { getEncodedCallFn } from ".";

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
} from "./actionTypes";

const { ethers } = require("ethers");
const INIT_STATE = {
  calls: {},
  /*
   * calls: { "0xsfsdf"_getBalance(nicolas): {
   *   <address>_<encodedCall>: {
   *       state: "LOADING|LOADED|ERROR",
   *       value: <decodedValue>,
   *       retries: undefined | number
   *   }
   * }
   *
   */
  call_metadata: {}, // Different dictionary to avoid re-rendering if only timestamp changes
  /*
   * <call_key>: {timestamp: <timestamp-with-milisecs>}
   */
  subscriptions: {},
  /*
   * <component_key>: [ ETH call list ]
   */
  timestamp: 0,
  transacts: [],
  signs: {},
};

export const EthereumReducer = (state = INIT_STATE, action) => {
  switch (action.type) {
    case ETH_CALL:
      let key = action.address + "_" + getEncodedCallFn(action.address, action.abi, action.method, action.args);
      let newCallState = state.calls[key] ? { ...state.calls[key] } : {};
      if (newCallState.state !== "LOADED")
        newCallState.state = newCallState.state !== "LOADED" ? "LOADING" : newCallState.state;
      if (action.retry !== undefined) newCallState.retries = action.retry;
      state = { ...state, calls: { ...state.calls, [key]: newCallState } };
      break;

    case ETH_CALL_SUCCESS:
      state = {
        ...state,
        calls: {
          ...state.calls,
          [action.call_key]: { state: "LOADED", value: action.value },
        },
        call_metadata: {
          ...state.call_metadata,
          [action.call_key]: {
            ...(state.call_metadata[action.call_key] || {}),
            timestamp: action.timestamp,
          },
        },
      };
      break;

    case ETH_CALL_FAIL:
      state = {
        ...state,
        calls: {
          ...state.calls,
          [action.call_key]: { ...state.calls[action.call_key], state: "ERROR" },
        },
      };
      break;

    case ETH_ADD_SUBSCRIPTION:
      state = {
        ...state,
        subscriptions: {
          ...state.subscriptions,
          [action.key]: action.componentEthCalls,
        },
      };
      break;

    case ETH_REMOVE_SUBSCRIPTION:
      let newMountedComponents = { ...state.subscriptions };
      delete newMountedComponents[action.key];
      state = {
        ...state,
        subscriptions: newMountedComponents,
      };
      break;

    case SET_TIMESTAMP_TO_REFRESH:
      state = {
        ...state,
        timestamp: action.timestamp,
      };
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

    case ETH_EIP_712_SIGN:
      const eipKey = ethers.utils._TypedDataEncoder.encode(action.domain, action.types, action.value);
      state = {
        ...state,
        signs: {
          ...state.signs,
          [eipKey]: { state: "PENDING" },
        },
      };
      break;

    case ETH_EIP_712_SIGN_PROCESSED:
      state = {
        ...state,
        signs: {
          ...state.signs,
          [action.key]: {
            state: "SIGNED",
            userAddress: action.userAddress,
            signature: action.signature,
            domain: action.domain,
            types: action.types,
            value: action.value,
          },
        },
      };
      break;

    case ETH_EIP_712_SIGN_FAILED:
      state = {
        ...state,
        signs: {
          ...state.signs,
          [action.key]: {
            ...state.signs[action.key],
            state: "ERROR",
            error: action.payload,
            userAddress: action.userAddress,
          },
        },
      };
      break;

    default:
      state = { ...state };
      break;
  }
  return state;
};
