import _ from "lodash";
import { ethereum, gas } from "../../config";
import { call, put, takeEvery, delay, select } from "redux-saga/effects";

// Ethereum Redux States
import {
  ETH_CALL,
  ETH_CALL_SUCCESS,
  ETH_CALL_FAIL,
  ETH_ADD_SUBSCRIPTION,
  ETH_DISPATCH_CLOCK,
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
  ETH_PLAIN_SIGN,
  ETH_PLAIN_SIGN_PROCESSED,
  ETH_PLAIN_SIGN_FAILED,
} from "./actionTypes";
import { selectEthCallTimestampByKey } from "./selectors";
import {
  getEncodedCallFn,
  getContractFn,
  getAbiNameFn,
  getFormatterFn,
  getSignerContractFn,
  getTxReceiptStatusFn,
  selectChainIdFn,
  selectProviderFn,
  selectUserAddressFn,
} from "../../package-index";

const { ethers } = require("ethers");

async function signMessageTyped(userState, domain, types, value) {
  const provider = new ethers.BrowserProvider(selectProviderFn(userState), "any");
  const signer = await provider.getSigner();
  const signatureHash = await signer.signTypedData(domain, types, value);
  return signatureHash;
}

async function signMessage(userState, address, message) {
  const provider = new ethers.BrowserProvider(selectProviderFn(userState), "any");
  const signer = await provider.getSigner();
  const signatureHash = await signer.signMessage(message);
  return signatureHash;
}

function customErrorParser(error) {
  const stringToFind = 'reason":"';
  let custom = JSON.stringify(error);
  if (custom && custom.includes(stringToFind)) {
    let start_index = custom.indexOf(stringToFind) + stringToFind.length;
    let end_index = custom.indexOf('",', start_index);
    let new_string = custom.slice(start_index, end_index);
    return new_string;
  }
  return undefined;
}

async function ethCall(address, abi, method, args) {
  let contract = getContractFn(address);
  let formatter = getFormatterFn(abi || getAbiNameFn(address), method);
  args = args || [];
  if (formatter !== undefined) return formatter(await contract[method](...args));
  else return await contract[method](...args);
}

async function ethSignerCall(address, abi, method, args, userState) {
  let provider = new ethers.BrowserProvider(selectProviderFn(userState), "any");
  let contract = await getSignerContractFn(address, abi, provider);
  const estimatedGas = await contract[method].estimateGas(...args).then((gas) => {
    return gas;
  });

  args = args || [];
  const gasLimit = (estimatedGas * ethers.toBigInt(gas.increase)) / 100n;
  return await contract[method](...args, { gasLimit: gasLimit });
}

export function* makeEthCall({ retry, address, abi, method, args, forceCall, maxAge }) {
  const state = yield select((state) => state.EthereumReducer);
  const rpc = state.currentChain.rpc;
  const key = address + "_" + getEncodedCallFn(address, abi, method, args, rpc);
  if (forceCall === undefined || forceCall === false) {
    maxAge = maxAge === undefined ? ethereum.defaultMaxAge : maxAge;
    const state = yield select((state) => state.EthereumReducer);
    const timestamp = selectEthCallTimestampByKey(state, key);
    if (timestamp !== undefined) {
      const now = new Date().getTime();
      if (now - timestamp < maxAge) {
        return; // Skip the repeated call
      }
    }
  }
  try {
    const response = yield call(_.partial(ethCall, address, abi, method, args));
    yield put({ type: ETH_CALL_SUCCESS, call_key: key, value: response, timestamp: new Date().getTime() });
  } catch (error) {
    retry = (retry || 0) + 1;
    yield delay(ethereum.retry.timeout * retry);
    if (retry < ethereum.retry.count) {
      yield put({
        type: ETH_CALL,
        retry: retry,
        address: address,
        abi: abi,
        method: method,
        args: args,
      });
    } else {
      yield put({ type: ETH_CALL_FAIL, payload: error.message, call_key: key, error: true });
    }
  }
}

export function* makeEthTransact({ address, abi, method, args }) {
  const state = yield select((state) => state.EthereumReducer);
  const userState = yield select((state) => state.UserReducer);
  const chainId = state.currentChain.id;
  const id = state.chainState[chainId].transacts.length - 1;
  try {
    if (selectChainIdFn(userState) === chainId) {
      const response = yield call(_.partial(ethSignerCall, address, abi, method, args, userState));
      yield put({ type: ETH_TRANSACT_QUEUED, id: id, txHash: response.hash });
    }
  } catch (error) {
    const customError = customErrorParser(error);
    const fullError = `${customError || error.message}`;
    yield put({ type: ETH_TRANSACT_REJECTED, id: id, payload: fullError });
  }
}

export function* listenTransact({ id, txHash, retry }) {
  let response;
  const userState = yield select((state) => state.UserReducer);
  let provider = new ethers.BrowserProvider(selectProviderFn(userState), "any");
  try {
    yield delay(ethereum.retry.timeout * 10);
    if (!retry || retry < ethereum.retry.transactCount) {
      response = yield call(getTxReceiptStatusFn, txHash, provider);
      if (response === null) {
        yield put({ type: ETH_TRANSACT_QUEUED, id: id, txHash: txHash, retry: (retry || 0) + 1 });
      } else if (response === 1) {
        // 1 is success
        yield put({ type: ETH_TRANSACT_MINED, id: id });
      } else if (response === 0) {
        yield put({ type: ETH_TRANSACT_REVERTED, id: id, payload: `Tx ${txHash} reverted`, error: true });
      }
    } else {
      yield put({ type: ETH_TRANSACT_EXPIRED, id: id });
    }
  } catch (error) {
    yield put({ type: ETH_TRANSACT_REJECTED, id: id, payload: error.message, error: true });
  }
}

export function* refreshAllSubscriptionsCalls() {
  const state = yield select((state) => state.EthereumReducer);
  const chainId = state.currentChain.id;
  const rpc = state.currentChain.rpc;
  const subscriptions = state.chainState[chainId]?.subscriptions;
  const now = new Date().getTime();
  const timestamp = state.timestamp;
  if (timestamp === 0 || timestamp < now) {
    const keyArray = new Set();
    const ethCalls = new Set();
    for (const key in subscriptions) {
      const subscriptionArray = subscriptions[key];
      for (const sub of subscriptionArray) {
        let key = sub.address + "_" + getEncodedCallFn(sub.address, sub.abi, sub.method, sub.args, rpc);
        if (!keyArray.has(key)) ethCalls.add(sub);
        keyArray.add(key);
      }
    }

    for (const call of Array.from(ethCalls)) {
      yield put({
        type: "ETH_CALL",
        address: call.address,
        abi: call.abi,
        method: call.method,
        args: call.args,
      });
    }
    yield put({ type: SET_TIMESTAMP_TO_REFRESH, timestamp: now + 10000 });
  }
}

export function* makeEthComponentCalls() {
  yield put({ type: SET_TIMESTAMP_TO_REFRESH, timestamp: 0 });
}

export function* makeEthEipSign({ domain, types, value }) {
  const userState = yield select((state) => state.UserReducer);
  const addr = selectUserAddressFn(userState);
  try {
    const signatureHash = yield call(signMessageTyped, userState, domain, types, value);
    yield put({
      type: ETH_EIP_712_SIGN_PROCESSED,
      key: ethers.TypedDataEncoder.encode(domain, types, value),
      userAddress: addr,
      signature: signatureHash,
      domain: domain,
      types: types,
      value: value,
    });
  } catch (error) {
    yield put({
      type: ETH_EIP_712_SIGN_FAILED,
      key: ethers.TypedDataEncoder.encode(domain, types, value),
      userAddress: addr,
      payload: error.message,
    });
  }
}

export function* makeEthSiweSign({ message, userAddress, email, country, occupation, whitelist }) {
  const userState = yield select((state) => state.UserReducer);
  const addr = ethers.getAddress(userAddress);
  try {
    const signatureHash = yield call(signMessage, userState, addr, message);
    yield put({
      type: ETH_SIWE_SIGN_PROCESSED,
      key: addr,
      signature: signatureHash,
      message: message,
      email: email,
      country: country,
      occupation: occupation,
      whitelist: whitelist,
    });
  } catch (error) {
    yield put({ type: ETH_SIWE_SIGN_FAILED, key: addr, payload: error.message });
  }
}

export function* makeSign({ message, userAddress }) {
  const userState = yield select((state) => state.UserReducer);
  const addr = ethers.getAddress(userAddress);
  try {
    const signatureHash = yield call(signMessage, userState, addr, message);
    yield put({
      type: ETH_PLAIN_SIGN_PROCESSED,
      key: addr,
      signature: signatureHash,
      message: message,
    });
  } catch (error) {
    yield put({ type: ETH_PLAIN_SIGN_FAILED, key: addr, payload: error.message });
  }
}

export function* ethereumSaga() {
  yield takeEvery(ETH_CALL, makeEthCall);
  yield takeEvery(ETH_ADD_SUBSCRIPTION, makeEthComponentCalls);
  yield takeEvery(ETH_DISPATCH_CLOCK, refreshAllSubscriptionsCalls);
  yield takeEvery(ETH_TRANSACT, makeEthTransact);
  yield takeEvery(ETH_TRANSACT_QUEUED, listenTransact);
  yield takeEvery(ETH_PLAIN_SIGN, makeSign);
  yield takeEvery(ETH_SIWE_SIGN, makeEthSiweSign);
  yield takeEvery(ETH_EIP_712_SIGN, makeEthEipSign);
}

export default ethereumSaga;
