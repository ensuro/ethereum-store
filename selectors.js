import _ from "lodash";
import { createSelector } from "reselect";
import { getEncodedCallFn } from ".";

const { ethers } = require("ethers");

const getCalls = (state) => state.calls;
const getCallMetadata = (state) => state.call_metadata;
const getTransacts = (state) => state.transacts;
const getSigns = (state) => state.signs;

const getCallKey = (__, address, abiName, method, ...args) =>
  address + "_" + getEncodedCallFn(address, abiName, method, args);

const getCallKeys = (__, calls) =>
  _.map(calls, (call) => {
    return call.address + "_" + getEncodedCallFn(call.address, call.abi, call.method, call.args);
  });

export const selectEthCall = createSelector(
  [getCalls, getCallKey],
  (calls, callKey) => calls[callKey] && calls[callKey].value
);

export const selectEthCallTimestamp = createSelector(
  [getCallMetadata, getCallKey],
  (callMeta, callKey) => callMeta[callKey] && callMeta[callKey].timestamp
);

export const selectEthCallTimestampByKey = createSelector(
  [getCallMetadata, (__, callKey) => callKey],
  (callMeta, callKey) => callMeta[callKey] && callMeta[callKey].timestamp
);

export const selectEthCallState = createSelector(
  [getCalls, getCallKey],
  (calls, callKey) => calls[callKey] && calls[callKey].state
);

export const selectEthCallMultiple = createSelector([getCalls, getCallKeys], (calls, callKeys) =>
  _.map(callKeys, (callKey) => {
    return calls[callKey] === undefined ? {} : { value: calls[callKey].value, state: calls[callKey].state };
  })
);

export const selectLastTransact = createSelector([getTransacts], (transacts) => transacts[transacts.length - 1]);

export const selectBiggerSign = createSelector([getSigns, (__, addr, nonce) => ({ addr, nonce })], (signs, params) => {
  const userAddr = ethers.utils.getAddress(params.addr);
  const nonce = params.nonce;
  const filteredSigns = Object.keys(signs).filter((sign) => {
    return signs[sign].state === "SIGNED" && userAddr === signs[sign].userAddress && signs[sign].value.nonce.eq(nonce);
  });
  const sortedSigns = filteredSigns.sort((s1, s2) => {
    return signs[s2].value.value - signs[s1].value.value;
  });

  return signs[sortedSigns[0]];
});