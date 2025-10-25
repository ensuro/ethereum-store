import _ from "lodash";
import Big from "big.js";
import assert from "assert";

import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import reducer from "./reducer.js";
import saga from "./saga.js";

import * as contractRegistry from "../../helpers/contractRegistry.js";
import { initializeEthereumStore } from "../../package-index.js";
import {
  selectEthCall,
  selectEthCallMultiple,
  selectEthCallState,
  selectEthCallTimestampByKey,
  selectSign,
  selectLastTransact,
} from "./selectors.js";

// Mock config
vi.mock("../../config", () => ({
  default: {
    ethereum: {
      retry: { timeout: 50, count: 3, transactCount: 300 },
      defaultMaxAge: 3000,
    },
    gas: { increase: 130 },
  },
}));

// Local helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Waits until predicate(fn()) is true, using polling.
 */
async function waitFor(fn, predicate, { timeout = 2000, step = 25 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = fn();
    if (predicate(v)) return v;
    await sleep(step);
  }
  return fn();
}

/**
 * "Plain" encoder for calls. Returns ONLY the selector/data (without repeating the address).
 */
function getEncodedCallPlain(address, abiName, method, args = []) {
  switch (method) {
    case "totalSupply":
      return "0x18160ddd";
    case "name":
      return "0x06fdde03";
    case "balanceOf": {
      const addr = (args[0] || "").toLowerCase();
      return "0x70a08231" + "0".repeat(24) + addr.slice(2);
    }
    default:
      return "0x" + method;
  }
}

/** Provider that RESOLVES signatures – valid EIP-1193 interface and also getSigner() */
function makeResolvingProvider() {
  return {
    // EIP-1193
    request: async ({ method }) => {
      const m = (method || "").toLowerCase();
      if (m.includes("signtypeddata")) return "0x0987654321";
      if (m.includes("personal_sign")) return "0x1234567890";
      if (m === "eth_chainid") return "0x1";
      if (m === "eth_accounts") return ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785"];
      return null;
    },
    // for compatibility if the saga uses signer.* directly
    getSigner() {
      return {
        signMessage: async () => "0x1234567890",
        signTypedData: async () => "0x0987654321",
        getAddress: async () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785",
      };
    },
  };
}

/** Creates a ProviderRpcError with code/message so ethers doesn't "coalesce" it into another shape */
function rpcError(message, code = 4001, data = undefined) {
  const e = new Error(message);
  e.code = code;
  if (data !== undefined) e.data = data;
  return e;
}

/** Provider that REJECTS signatures – EIP-1193 */
function makeRejectingProvider() {
  const user = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
  return {
    request: async ({ method }) => {
      const m = (method || "").toLowerCase();

      // ethers makes these auxiliary calls: they should respond OK
      if (m === "eth_accounts") return [user];
      if (m === "eth_chainid") return "0x1";
      if (m === "eth_requestaccounts") return [user];

      // Fail ONLY on signing calls, with the correct ProviderRpcError
      if (m === "eth_sign" || m.includes("personal_sign")) {
        throw rpcError("Error signing message", 4001);
      }
      if (
        m === "eth_signtypeddata" ||
        m === "eth_signtypeddata_v3" ||
        m === "eth_signtypeddata_v4" ||
        m.includes("signtypeddata")
      ) {
        throw rpcError("Error signing typed message", 4001);
      }

      return null;
    },
    getSigner() {
      return {
        signMessage: async () => {
          throw rpcError("Error signing message", 4001);
        },
        signTypedData: async () => {
          throw rpcError("Error signing typed message", 4001);
        },
        getAddress: async () => user,
      };
    },
  };
}

/**
 * Dependencies awaited by initializeEthereumStore.
 */
function baseDeps(overrides = {}) {
  return {
    getEncodedCall: getEncodedCallPlain,
    getContract: () => fakeUsdcContract,
    getAbiName: contractRegistry.getAbiName,
    getFormatter: contractRegistry.getFormatter,
    getSignerContract: () => fakeUsdcContract,
    selectChainId: () => 1234,
    selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785",
    getTxReceiptStatus: async () => 1,
    clockCount: 15,
    ethereumRetry: { timeout: 50, count: 3 },
    selectProvider: () => makeResolvingProvider(),
    ...overrides,
  };
}

// Store helpers

function makeStore() {
  const sagaMiddleware = createSagaMiddleware();
  const s = configureStore({
    reducer: { EthereumReducer: reducer },
    middleware: (getDefault) =>
      getDefault({
        thunk: false,
        serializableCheck: false,
        immutableCheck: false,
      }).concat(sagaMiddleware),
    devTools: false,
  });
  sagaMiddleware.run(saga);
  return s;
}

// Setup contracts/ABI/formatters
const currencyAddress = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // Sepolia USDC

contractRegistry.registerABI("ERC20Permit", require("@openzeppelin/contracts/build/contracts/ERC20Permit.json").abi);
contractRegistry.registerContract(currencyAddress, "ERC20Permit");

// formatters: USDC  decimals
const BNToDecimal = (number, decimals) => Big(number).div(10 ** decimals);
contractRegistry.registerFormatter("ERC20Permit", "totalSupply", _.partial(BNToDecimal, _, 6));
contractRegistry.registerFormatter("ERC20Permit", "balanceOf", _.partial(BNToDecimal, _, 6));

let store;
let fakeUsdcContract = {};

beforeEach(async () => {
  fakeUsdcContract = {
    interface: contractRegistry.getContract(currencyAddress).interface,
  };

  initializeEthereumStore(baseDeps());

  store = makeStore();
  store.dispatch({ type: "RESET_ALL" });

  await store.dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "NewChain", id: 1234, rpc: "https://foo-rpc.com/" });
});

afterEach(() => {
  store.dispatch({ type: "RESET_ALL" });
});

describe("All the test with provider resolver mock", () => {
  beforeEach(() => {
    initializeEthereumStore(baseDeps({ selectProvider: () => makeResolvingProvider() }));
  });

  test("ETH_ADD_SUBSCRIPTION and ETH_DISPATCH_CLOCK with one ethCall", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6));

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "totalSupplyComponent",
      componentEthCalls: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
    });

    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: {
              functions: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 15,
              nextClock: 0,
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });

    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply"),
      undefined
    );

    store.dispatch({ type: "ETH_DISPATCH_CLOCK" });
    const call_key = currencyAddress + "_0x18160ddd";

    await sleep(0);

    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: Big(12.345) },
    });
    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );
  });

  test("ETH_ADD_SUBSCRIPTION and ETH_DISPATCH_CLOCK with two ethCall", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6));
    const fakeName = (fakeUsdcContract.name = vi.fn().mockResolvedValue("Peso"));

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "totalSupplyComponent",
      componentEthCalls: [
        { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
        { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
      ],
    });

    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: {
              functions: [
                { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
                { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
              ],
              clockCount: 15,
              nextClock: 0,
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });

    store.dispatch({ type: "ETH_DISPATCH_CLOCK" });
    const call_key = currencyAddress + "_0x18160ddd";
    const name_call_key = currencyAddress + "_0x06fdde03";

    await sleep(0);

    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: Big(12.345) },
      [name_call_key]: { state: "LOADED", value: "Peso" },
    });
    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);
    expect(fakeName).toHaveBeenCalledTimes(1);

    const makeEthCalls = () => [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
      { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
    ];

    const [totalSupply, name] = selectEthCallMultiple(store.getState().EthereumReducer, makeEthCalls());
    assert.ok(totalSupply.value.eq(Big(12.345)));
    assert(name.value === "Peso");

    const [newTotalSupply, newName] = selectEthCallMultiple(store.getState().EthereumReducer, makeEthCalls());
    assert.strictEqual(totalSupply, newTotalSupply);
    assert.strictEqual(name, newName);
  });

  test("Only ONE call with TWO subscritions to the SAME METHOD", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6));

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "totalSupplyComponent",
      componentEthCalls: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
    });

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "secondComponent",
      componentEthCalls: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
    });

    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: {
              functions: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 15,
              nextClock: 0,
            },
            secondComponent: {
              functions: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 15,
              nextClock: 0,
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });

    store.dispatch({ type: "ETH_DISPATCH_CLOCK" });
    const call_key = currencyAddress + "_0x18160ddd";
    await sleep(0);
    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: Big(12.345) },
    });
    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);

    await store.dispatch({ type: "ETH_REMOVE_SUBSCRIPTION", key: "secondComponent" });
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].subscriptions, {
      totalSupplyComponent: {
        functions: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
        clockCount: 15,
        nextClock: 15,
      },
    });

    assert.deepStrictEqual(store.getState().EthereumReducer.currentClock, 1);
  });

  test("ETH_CALL with simple method", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6));

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });
    const call_key = currencyAddress + "_0x18160ddd";
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: { 1234: { calls: { [call_key]: { state: "LOADING" } } } },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });

    const now = Date.now();
    await sleep(0);

    const ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, { [call_key]: { state: "LOADED", value: Big(12.345) } });
    assert(now - ethStore.chainState["1234"].call_metadata[call_key].timestamp < 100);
    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );
  });

  test("ETH_CALL with simple without formatter", async () => {
    const fakeName = (fakeUsdcContract.name = vi.fn().mockResolvedValue("Peso"));

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "name" });
    const call_key = currencyAddress + "_0x06fdde03";
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: { 1234: { calls: { [call_key]: { state: "LOADING" } } } },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await sleep(0);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: "Peso" },
    });
    expect(fakeName).toHaveBeenCalledTimes(1);
  });

  test("ETH_CALL method with parameter", async () => {
    const fakeBalanceOf = (fakeUsdcContract.balanceOf = vi.fn().mockResolvedValue(78.345678e6));
    const addr = "0x4d68cf31d613070b18e406afd6a42719a62a0785";

    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "balanceOf",
      args: [addr],
    });

    const call_key = currencyAddress + "_0x70a08231000000000000000000000000" + addr.substring(2);
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: { 1234: { calls: { [call_key]: { state: "LOADING" } } } },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await sleep(0);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: Big(78.345678) },
    });
    expect(fakeBalanceOf).toHaveBeenCalledTimes(1);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "balanceOf", addr).eq(
        Big(78.345678)
      )
    );
  });

  test("ETH_CALL fails (eventual ERROR)", async () => {
    initializeEthereumStore(baseDeps({ ethereumRetry: { timeout: 10, count: 3 } }));

    fakeUsdcContract.totalSupply = vi.fn().mockRejectedValue("Error");
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    const call_key = currencyAddress + "_0x18160ddd";

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].calls[call_key]?.state,
      (s) => s === "ERROR",
      { timeout: 3000, step: 25 }
    );
    const state = store.getState().EthereumReducer;

    assert.strictEqual(state.chainState["1234"].calls[call_key].state, "ERROR");
    assert.ok(state.chainState["1234"].calls[call_key].retries >= 1);
  });

  test("ETH_CALL with retries (se recupera)", async () => {
    initializeEthereumStore(baseDeps({ ethereumRetry: { timeout: 10, count: 5 } }));

    fakeUsdcContract.totalSupply = vi.fn().mockRejectedValue("Error");
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    const call_key = currencyAddress + "_0x18160ddd";

    await sleep(30);
    fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(123.2e6);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].calls[call_key],
      (v) => v && v.state === "LOADED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: { state: "LOADED", value: Big(123.2) },
    });
  });

  test("ETH_TRANSACT approve (estado final MINED)", async () => {
    const txHash = "0x000001";
    const txStatus = 1;
    fakeUsdcContract.approve = vi.fn().mockResolvedValue({ hash: txHash });
    fakeUsdcContract.approve.estimateGas = vi.fn().mockResolvedValue(100000n);

    initializeEthereumStore(
      baseDeps({
        selectProvider: () => makeResolvingProvider(),
        getTxReceiptStatus: vi.fn().mockResolvedValue(txStatus),
      })
    );

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    await waitFor(
      () => selectLastTransact(store.getState().EthereumReducer)?.state,
      (s) => s === "MINED",
      { timeout: 4000, step: 50 }
    );
    const lastTx = selectLastTransact(store.getState().EthereumReducer);

    assert.deepStrictEqual(lastTx.state, "MINED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_TRANSACT reverted (estado final REVERTED)", async () => {
    const txHash = "0x000001";
    const txStatus = 0;
    fakeUsdcContract.approve = vi.fn().mockResolvedValue({ hash: txHash });
    fakeUsdcContract.approve.estimateGas = vi.fn().mockResolvedValue(100000n);

    initializeEthereumStore(
      baseDeps({
        selectProvider: () => makeResolvingProvider(),
        getTxReceiptStatus: vi.fn().mockResolvedValue(txStatus),
      })
    );

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    await waitFor(
      () => selectLastTransact(store.getState().EthereumReducer)?.state,
      (s) => s === "REVERTED",
      { timeout: 4000, step: 50 }
    );
    const lastTx = selectLastTransact(store.getState().EthereumReducer);

    assert.deepStrictEqual(lastTx.state, "REVERTED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_TRANSACT rejected (estado final REJECTED)", async () => {
    const txHash = "0x000001";
    fakeUsdcContract.approve = vi.fn().mockResolvedValue({ hash: txHash });
    fakeUsdcContract.approve.estimateGas = vi.fn().mockResolvedValue(100000n);

    initializeEthereumStore(
      baseDeps({
        selectProvider: () => makeResolvingProvider(),
        getTxReceiptStatus: vi.fn().mockRejectedValue(new Error("boom")),
      })
    );

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    await waitFor(
      () => selectLastTransact(store.getState().EthereumReducer)?.state,
      (s) => s === "REJECTED",
      { timeout: 4000, step: 50 }
    );
    const lastTx = selectLastTransact(store.getState().EthereumReducer);

    assert.deepStrictEqual(lastTx.state, "REJECTED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_CALL method with timestamp", async () => {
    fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6);
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });
    const call_key = currencyAddress + "_0x18160ddd";
    await sleep(1000);

    const prevTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    await sleep(1000);
    let newTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);
    assert.strictEqual(prevTimestamp, newTimestamp);

    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
      maxAge: 100,
    });
    await sleep(1000);

    newTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);
    let state = selectEthCallState(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply");
    assert.strictEqual(state, "LOADED");
    assert.notStrictEqual(prevTimestamp, newTimestamp);
  });

  test("ETH_PLAIN_SIGN with message (estado final SIGNED)", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      key: "testPlainSign",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    const key = `testPlainSign_${userAddr}`;
    assert.ok(store.getState().EthereumReducer.chainState["1234"].signs[key]);

    await waitFor(
      () => selectSign(store.getState().EthereumReducer, "testPlainSign", userAddr)?.state,
      (s) => s === "SIGNED",
      {
        timeout: 2000,
        step: 25,
      }
    );

    const sign = selectSign(store.getState().EthereumReducer, "testPlainSign", userAddr);
    assert.deepStrictEqual(sign.state, "SIGNED");
    assert.deepStrictEqual(sign.signature, "0x1234567890");
    assert.deepStrictEqual(sign.message, "Simple example of plain text");
  });

  test("Signed eip712 message ETH_EIP_712_SIGN (estado final SIGNED)", async () => {
    const { ethers } = await import("ethers");
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    fakeUsdcContract.nonces = vi.fn().mockResolvedValue(2);

    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 100e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });
    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);

    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key]?.state,
      (s) => s === "SIGNED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);
  });

  test("Signed two eip712 message ETH_EIP_712_SIGN and get the bigger sign", async () => {
    const { ethers } = await import("ethers");
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    fakeUsdcContract.nonces = vi.fn().mockResolvedValue(2);

    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    let value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 100e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });
    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key]?.state,
      (s) => s === "SIGNED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);

    value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 200e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });
    const key2 = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key2]?.state,
      (s) => s === "SIGNED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].state, "SIGNED");
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].signature,
      "0x0987654321"
    );
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].value, value);

    const { selectBiggerSign } = await import("./selectors.js");
    let biggerSign = selectBiggerSign(
      store.getState().EthereumReducer,
      userAddr,
      await fakeUsdcContract.nonces(userAddr),
      spenderAddr
    );

    assert.deepStrictEqual(biggerSign.value.value.toString(), "200000000");
  });

  test("Get the bigger sign of different spender", async () => {
    const { ethers } = await import("ethers");
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD";
    const secondSpender = "0x329731D4FB96Ec52039e222bC4cC67a86b582A86";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    fakeUsdcContract.nonces = vi.fn().mockResolvedValue(2);
    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };

    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    let value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 100e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });
    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key]?.state,
      (s) => s === "SIGNED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value.spender,
      ethers.getAddress(spenderAddr)
    );

    value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(secondSpender),
      value: 200e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });
    const key2 = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key2]?.state,
      (s) => s === "SIGNED",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].state, "SIGNED");
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].signature,
      "0x0987654321"
    );
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].value, value);
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].value.spender,
      ethers.getAddress(secondSpender)
    );

    const { selectBiggerSign } = await import("./selectors.js");
    let biggerSign = selectBiggerSign(
      store.getState().EthereumReducer,
      userAddr,
      await fakeUsdcContract.nonces(userAddr),
      spenderAddr
    );
    assert.deepStrictEqual(biggerSign.value.value.toString(), "100000000");

    const unknownSpender = "0xd8F30147961b99d89222E660b3d3855C5eB12330";
    biggerSign = selectBiggerSign(
      store.getState().EthereumReducer,
      userAddr,
      await fakeUsdcContract.nonces(userAddr),
      unknownSpender
    );
    assert.deepStrictEqual(biggerSign, undefined);
  });

  test("ETH_CALL, change Chain and ETH_CALL again", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = vi.fn().mockResolvedValue(12.345e6));
    const fakeName = (fakeUsdcContract.name = vi.fn().mockResolvedValue("FakeUSDC"));

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });
    const call_key = currencyAddress + "_0x18160ddd";
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: { 1234: { calls: { [call_key]: { state: "LOADING" } } } },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    const now = Date.now();
    await sleep(0);
    let ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, { [call_key]: { state: "LOADED", value: Big(12.345) } });
    assert(now - ethStore.chainState["1234"].call_metadata[call_key].timestamp < 100);
    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);

    const { selectEthCall } = await import("./selectors.js");
    const ethCall = selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply");
    assert.ok(ethCall.eq(Big(12.345)));
    assert.strictEqual(
      ethCall,
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply")
    );

    store.dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "SecondChain", id: 5678, rpc: "https://foo-rpc.com/" });

    ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.currentChain, { id: 5678, name: "SecondChain", rpc: "https://foo-rpc.com/" });

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "name" });
    const call_key_2 = currencyAddress + "_0x06fdde03";
    await sleep(0);

    ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, { [call_key]: { state: "LOADED", value: Big(12.345) } });
    assert.deepEqual(ethStore.chainState["5678"].calls, { [call_key_2]: { state: "LOADED", value: "FakeUSDC" } });

    expect(fakeTotalSupply).toHaveBeenCalledTimes(1);
    expect(fakeName).toHaveBeenCalledTimes(1);
  });
});

describe("All the tests with provider REJECTED Mock", () => {
  beforeEach(() => {
    initializeEthereumStore(baseDeps({ selectProvider: () => makeRejectingProvider() }));
  });

  test("Rejects eip712 message ETH_EIP_712_SIGN (estado final ERROR)", async () => {
    const { ethers } = await import("ethers");
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60;
    fakeUsdcContract.nonces = vi.fn().mockResolvedValue(2);

    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 100e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types, value });

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.ok(store.getState().EthereumReducer.chainState["1234"].eipSigns[key]);

    await waitFor(
      () => store.getState().EthereumReducer.chainState["1234"].eipSigns[key]?.state,
      (s) => s === "ERROR",
      { timeout: 2000, step: 25 }
    );

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "ERROR");
    assert.ok(
      String(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].error).includes(
        "Error signing typed message"
      )
    );
  });

  test("Rejects ETH_PLAIN_SIGN with message (estado final ERROR)", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      key: "testPlainKey",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    const key = `testPlainKey_${userAddr}`;
    assert.ok(store.getState().EthereumReducer.chainState["1234"].signs[key]);

    await waitFor(
      () => selectSign(store.getState().EthereumReducer, "testPlainKey", userAddr)?.state,
      (s) => s === "ERROR",
      {
        timeout: 2000,
        step: 25,
      }
    );

    const sign = selectSign(store.getState().EthereumReducer, "testPlainKey", userAddr);
    assert.deepStrictEqual(sign.state, "ERROR");
    assert.ok(String(sign.error).includes("Error signing message"));
  });
});
