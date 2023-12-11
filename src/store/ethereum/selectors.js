import _ from "lodash";
import { createSelector } from "reselect";
import { getEncodedCallFn } from "../../package-index";

const { ethers } = require("ethers");

const getTransacts = (state) => state.transacts;
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

const getChainStateSiweSigns = (state) => {
  const chainId = getCurrentChain(state).id;
  const chainState = getChainState(state);
  return chainState[chainId] && chainState[chainId].siweSigns ? chainState[chainId].siweSigns : {};
};

const getSignKey = (__, address) => {
  return address;
};

const getCallKey = (__, address, abiName, method, ...args) =>
  address + "_" + getEncodedCallFn(address, abiName, method, args);

const getCallKeys = (__, calls) =>
  _.map(calls, (call) => {
    return call.address + "_" + getEncodedCallFn(call.address, call.abi, call.method, call.args);
  });

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

export const selectLastTransact = createSelector([getTransacts], (transacts) => transacts[transacts.length - 1]);

export const selectSign = createSelector([getChainStatePlainSigns, getSignKey], (signs, signKey) => signs[signKey]);

export const selectEthSiweSign = createSelector(
  [getChainStateSiweSigns, getSignKey],
  (signs, ethSignKey) => signs[ethSignKey]
);

export const selectBiggerSign = createSelector(
  [getChainStateEIPSigns, (__, addr, nonce, spender) => ({ addr, nonce, spender })],
  (signs, params) => {
    const userAddr = ethers.utils.getAddress(params.addr);
    const nonce = params.nonce;
    const spenderAddr = params.spender ? ethers.utils.getAddress(params.spender) : "";
    const filteredSigns = Object.keys(signs).filter((sign) => {
      return (
        signs[sign].state === "SIGNED" &&
        userAddr === ethers.utils.getAddress(signs[sign].userAddress) &&
        signs[sign].value.nonce.eq(nonce) &&
        spenderAddr &&
        spenderAddr === ethers.utils.getAddress(signs[sign].value.spender)
      );
    });
    const sortedSigns = filteredSigns.sort((s1, s2) => {
      return signs[s2].value.value - signs[s1].value.value;
    });

    return signs[sortedSigns[0]];
  }
);
