import _ from "lodash";
import { createSelector } from "reselect";
import { getEncodedCallFn } from "../../package-index";

const { ethers } = require("ethers");

const getCurrentChain = (state) => state.currentChain;
const getChainState = (state) => state.chainState;

const getChainStateCalls = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] ? chainState[chainId].calls : {};
};

const getChainStateCallMetadata = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] ? chainState[chainId].call_metadata : {};
};

const getChainStateEIPSigns = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] && chainState[chainId].eipSigns ? chainState[chainId].eipSigns : {};
};

const getChainStatePlainSigns = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] && chainState[chainId].signs ? chainState[chainId].signs : {};
};

const getChainStateTransacts = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] && chainState[chainId].transacts ? chainState[chainId].transacts : [];
};

const getSignKey = (__, key, address) => {
  return `${key}_${address}`;
};

const getCallKey = (state, address, abiName, method, ...args) => {
  const rpc = state.currentChain.rpc;
  return address + "_" + getEncodedCallFn(address, abiName, method, args, rpc);
};

const getCallKeys = (state, calls) => {
  const rpc = state.currentChain.rpc;
  return _.map(calls, (call) => {
    return call.address + "_" + getEncodedCallFn(call.address, call.abi, call.method, call.args, rpc);
  });
};

export const selectCurrentChain = createSelector([getCurrentChain], (currentChain) => currentChain);

export const selectEthCall = createSelector(
  [getChainStateCalls, getCallKey],
  (calls, callKey) => calls && calls[callKey] && calls[callKey].value
);

export const selectEthCallTimestamp = createSelector(
  [getChainStateCallMetadata, getCallKey],
  (callMeta, callKey) => callMeta && callMeta[callKey] && callMeta[callKey].timestamp
);

export const selectEthCallTimestampByKey = createSelector(
  [getChainStateCallMetadata, (__, callKey) => callKey],
  (callMeta, callKey) => callMeta && callMeta[callKey] && callMeta[callKey].timestamp
);

export const selectEthCallState = createSelector(
  [getChainStateCalls, getCallKey],
  (calls, callKey) => calls[callKey] && calls[callKey].state
);

export const selectEthCallMultiple = createSelector([getChainStateCalls, getCallKeys], (calls, callKeys) => {
  return _.map(callKeys, (callKey) => {
    return !calls || calls[callKey] === undefined ? {} : { value: calls[callKey].value, state: calls[callKey].state };
  });
});

export const selectLastTransact = createSelector(
  [getChainStateTransacts],
  (transacts) => transacts[transacts.length - 1]
);

export const selectSign = createSelector([getChainStatePlainSigns, getSignKey], (signs, signKey) => signs[signKey]);

export const selectBiggerSign = createSelector(
  [getChainStateEIPSigns, (__, addr, nonce, spender) => ({ addr, nonce, spender })],
  (signs, params) => {
    const userAddr = ethers.getAddress(params.addr);
    const nonce = params.nonce;
    const spenderAddr = params.spender ? ethers.getAddress(params.spender) : "";
    const filteredSigns = Object.keys(signs).filter((sign) => {
      return (
        signs[sign].state === "SIGNED" &&
        userAddr === ethers.getAddress(signs[sign].userAddress) &&
        signs[sign].value.nonce === nonce &&
        spenderAddr &&
        spenderAddr === ethers.getAddress(signs[sign].value.spender)
      );
    });
    const sortedSigns = filteredSigns.sort((s1, s2) => {
      return signs[s2].value.value - signs[s1].value.value;
    });

    return signs[sortedSigns[0]];
  }
);
