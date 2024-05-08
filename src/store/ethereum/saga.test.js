import _ from "lodash";
import Big from "big.js";
import assert from "assert";
import store from "../index.js";
import * as mock_helper from "../../helpers/mock_helper";
import * as contractRegistry from "../../helpers/contractRegistry";

import { initializeEthereumStore } from "../../package-index";
import {
  selectBiggerSign,
  selectEthCall,
  selectEthCallMultiple,
  selectEthCallState,
  selectEthCallTimestampByKey,
  selectSign,
  selectLastTransact,
} from "./selectors";
import { ethereum } from "../../config";

const sinon = require("sinon");
const { ethers } = require("ethers");

let contractMock;
let providerMock;
const currencyAddress = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // Sepolia USDC address

/* This will be in the initialize.js file */
const BNToDecimal = (number, decimals) => {
  return Big(number).div(10 ** decimals);
};
contractRegistry.registerABI("ERC20Permit", require("@openzeppelin/contracts/build/contracts/ERC20Permit.json").abi);
contractRegistry.registerContract(currencyAddress, "ERC20Permit");
contractRegistry.registerFormatter("ERC20Permit", "totalSupply", _.partial(BNToDecimal, _, 6));
contractRegistry.registerFormatter("ERC20Permit", "balanceOf", _.partial(BNToDecimal, _, 6));
/* */

const usdcContract = contractRegistry.getContract(currencyAddress);
let fakeUsdcContract = {};

beforeEach(async () => {
  store.dispatch({ type: "RESET_ALL" });
  contractMock = sinon.spy(mock_helper.mockContractFn());
  sinon.replaceGetter(ethers, "Contract", () => contractMock);

  fakeUsdcContract = { interface: usdcContract.interface };
  contractMock.byAddress(currencyAddress, fakeUsdcContract);
  contractRegistry.registerContract(currencyAddress, "ERC20Permit");

  await store.dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "NewChain", id: 1234, rpc: "https://foo-rpc.com/" });
});

afterEach(() => {
  store.dispatch({ type: "RESET_ALL" });
  sinon.restore();
});

describe("All the test with provider resolver mock", () => {
  beforeEach(() => {
    providerMock = sinon.spy(mock_helper.mockProviderFn());
    sinon.replaceGetter(ethers, "BrowserProvider", () => providerMock);
  });

  test("ETH_ADD_SUBSCRIPTION and ETH_DISPATCH_CLOCK with one ethCall", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6));
    assert.strictEqual(ethers.Contract.callCount, 1);

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
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")

    await new Promise((r) => setTimeout(r, 0));

    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
    });
    sinon.assert.calledOnce(fakeTotalSupply);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );
  });

  test("ETH_ADD_SUBSCRIPTION and ETH_DISPATCH_CLOCK with two ethCall", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6));
    const fakeName = (fakeUsdcContract.name = sinon.fake.resolves("Peso"));
    assert.strictEqual(ethers.Contract.callCount, 1);

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

    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply"),
      undefined
    );

    store.dispatch({ type: "ETH_DISPATCH_CLOCK" });
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    const name_call_key = currencyAddress + "_0x06fdde03"; // "06fdde03" == kekac256("name()")

    await new Promise((r) => setTimeout(r, 0));

    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
      [name_call_key]: {
        state: "LOADED",
        value: "Peso",
      },
    });
    sinon.assert.calledOnce(fakeTotalSupply);
    sinon.assert.calledOnce(fakeName);

    const [totalSupply, name] = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
      { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
    ]);

    assert.ok(totalSupply.value.eq(Big(12.345)));
    assert(name.value === "Peso");
  });

  test("Only ONE call with TWO subscritions to the SAME METHOD", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6));
    assert.strictEqual(ethers.Contract.callCount, 1);

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
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
    });
    sinon.assert.calledOnce(fakeTotalSupply); // only one call
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );

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
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });
    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply"),
      undefined
    );
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    const now = new Date().getTime();
    await new Promise((r) => setTimeout(r, 0));
    const ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
    });
    assert(now - ethStore.chainState["1234"].call_metadata[call_key].timestamp < 100);
    sinon.assert.calledOnce(fakeTotalSupply);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );
  });

  test("ETH_CALL with simple without formatter", async () => {
    const fakeName = (fakeUsdcContract.name = sinon.fake.resolves("Peso"));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "name" });
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x06fdde03"; // "06fdde03" == kekac256("name()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await new Promise((r) => setTimeout(r, 0));
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: "Peso",
      },
    });
    sinon.assert.calledOnce(fakeName);
  });

  test("ETH_CALL method with parameter", async () => {
    const fakeBalanceOf = (fakeUsdcContract.balanceOf = sinon.fake.resolves(78.345678e6));
    assert.strictEqual(ethers.Contract.callCount, 1);
    const addr = "0x4d68cf31d613070b18e406afd6a42719a62a0785";
    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "balanceOf",
      args: [addr],
    });

    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x70a08231000000000000000000000000" + addr.substring(2);
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await new Promise((r) => setTimeout(r, 0));
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(78.345678),
      },
    });
    sinon.assert.calledOnce(fakeBalanceOf);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "balanceOf", addr).eq(
        Big(78.345678)
      )
    );
  });

  test("ETH_CALL fails", async () => {
    sinon.replace(ethereum, "retry", { timeout: 1, count: 5 });
    fakeUsdcContract.totalSupply = sinon.fake.rejects("Error");
    assert.strictEqual(ethers.Contract.callCount, 1);
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await new Promise((r) => setTimeout(r, 100));
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              retries: 4,
              state: "ERROR",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
  });

  test("ETH_CALL with retries", async () => {
    sinon.replace(ethereum, "retry", { timeout: 10, count: 5 });
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.rejects("Error"));
    assert.strictEqual(ethers.Contract.callCount, 1);
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    await new Promise((r) => setTimeout(r, 15));
    fakeUsdcContract.totalSupply = sinon.fake.resolves(123.2e6);
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              retries: 1,
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    sinon.assert.calledTwice(fakeTotalSupply);
    await new Promise((r) => setTimeout(r, 21));
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(123.2),
      },
    });
  });

  test("ETH_TRANSACT approve", async () => {
    const txHash = "0x000001";
    const txStatus = 1; // 1 == "success"
    const fakeApprove = (fakeUsdcContract.approve = sinon.fake.resolves({ hash: txHash })); //TxHash
    const fakeEstimateGas = (fakeUsdcContract.approve["estimateGas"] = sinon.fake.resolves(100000n));
    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.resolves(txStatus),
      selectChainId: () => 1234, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    const id = store.getState().EthereumReducer.chainState["1234"].transacts.length - 1;
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].transacts[id].method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    let lastTx = selectLastTransact(store.getState().EthereumReducer);
    assert.deepStrictEqual(lastTx.state, "QUEUED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
    await new Promise((r) => setTimeout(r, 1000));

    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas, 1);

    lastTx = selectLastTransact(store.getState().EthereumReducer);

    assert.deepStrictEqual(lastTx.state, "MINED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_TRANSACT reverted", async () => {
    const txHash = "0x000001";
    const txStatus = 0; // 0 == reverted
    const fakeApprove = (fakeUsdcContract.approve = sinon.fake.resolves({ hash: txHash })); //TxHash
    const fakeEstimateGas = (fakeUsdcContract.approve["estimateGas"] = sinon.fake.resolves(100000n));

    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.resolves(txStatus),
      selectChainId: () => 1234, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    let lastTx = selectLastTransact(store.getState().EthereumReducer);
    assert.deepStrictEqual(lastTx.method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    lastTx = selectLastTransact(store.getState().EthereumReducer);
    assert.deepStrictEqual(lastTx.state, "QUEUED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
    await new Promise((r) => setTimeout(r, 1001));

    lastTx = selectLastTransact(store.getState().EthereumReducer);
    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas, 1);
    assert.deepStrictEqual(lastTx.state, "REVERTED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_TRANSACT rejected", async () => {
    const txHash = "0x000001";
    const txStatus = 0; // 0 == reverted
    const fakeApprove = (fakeUsdcContract.approve = sinon.fake.resolves({ hash: txHash })); //TxHash
    const fakeEstimateGas = (fakeUsdcContract.approve["estimateGas"] = sinon.fake.resolves(100000n));

    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.rejects(txStatus),
      selectChainId: () => 1234, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", 10],
    });

    let lastTx = selectLastTransact(store.getState().EthereumReducer);
    assert.deepStrictEqual(lastTx.method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    lastTx = selectLastTransact(store.getState().EthereumReducer);
    assert.deepStrictEqual(lastTx.state, "QUEUED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
    await new Promise((r) => setTimeout(r, 1001));

    lastTx = selectLastTransact(store.getState().EthereumReducer);
    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas, 1);
    assert.deepStrictEqual(lastTx.state, "REJECTED");
    assert.deepStrictEqual(lastTx.txHash, txHash);
  });

  test("ETH_CALL method with timestamp", async () => {
    fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6);
    assert.strictEqual(ethers.Contract.callCount, 1);
    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
    });
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    await new Promise((r) => setTimeout(r, 1000));

    const prevTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);
    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    await new Promise((r) => setTimeout(r, 1000));
    let newTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);
    assert.strictEqual(prevTimestamp, newTimestamp);

    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
      maxAge: 100,
    });
    await new Promise((r) => setTimeout(r, 1000));

    newTimestamp = selectEthCallTimestampByKey(store.getState().EthereumReducer, call_key);

    let state = selectEthCallState(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply");
    assert.strictEqual(state, "LOADED");
    assert.notStrictEqual(prevTimestamp, newTimestamp);
  });

  test("ETH_PLAIN_SIGN with message", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      key: "testPlainSign",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    const key = `testPlainSign_${userAddr}`;
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].signs[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectSign(store.getState().EthereumReducer, "testPlainSign", userAddr);
    assert.deepStrictEqual(sign.state, "SIGNED");
    assert.deepStrictEqual(sign.signature, "0x1234567890");
    assert.deepStrictEqual(sign.message, "Simple example of plain text");
  });

  test("ETH_PLAIN_SIGN with message and nextAction", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      key: "testPlainSign",
      message: "Simple example of plain text",
      userAddress: userAddr,
      nextAction: { type: "ETH_PLAIN_SIGN", key: "secondKey", message: "second message", userAddress: userAddr },
    });

    const key = `testPlainSign_${userAddr}`;
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].signs[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectSign(store.getState().EthereumReducer, "testPlainSign", userAddr);
    assert.deepStrictEqual(sign.state, "SIGNED");
    assert.deepStrictEqual(sign.signature, "0x1234567890");
    assert.deepStrictEqual(sign.message, "Simple example of plain text");

    const sign2 = selectSign(store.getState().EthereumReducer, "secondKey", userAddr);
    assert.deepStrictEqual(sign2.state, "SIGNED");
    assert.deepStrictEqual(sign2.signature, "0x1234567890");
    assert.deepStrictEqual(sign2.message, "second message");
  });

  test("Signed eip712 message ETH_EIP_712_SIGN", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    fakeUsdcContract.nonces = sinon.fake.resolves(2);
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
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);
  });

  test("Signed two eip712 message ETH_EIP_712_SIGN and get the bigger sign", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    fakeUsdcContract.nonces = sinon.fake.resolves(2);
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
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);

    value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(spenderAddr),
      value: 200e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key2 = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].state, "SIGNED");
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].signature,
      "0x0987654321"
    );
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].value, value);

    let biggerSign = selectBiggerSign(
      store.getState().EthereumReducer,
      userAddr,
      await fakeUsdcContract.nonces(userAddr),
      spenderAddr
    );

    assert.deepStrictEqual(biggerSign.value.value.toString(), "200000000"); // second signature is bigger
  });

  test("Get the bigger sign of different spender", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const secondSpender = "0x329731D4FB96Ec52039e222bC4cC67a86b582A86";
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    fakeUsdcContract.nonces = sinon.fake.resolves(2);
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
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value.spender,
      ethers.getAddress(spenderAddr)
    );

    // second spender
    value = {
      owner: ethers.getAddress(userAddr),
      spender: ethers.getAddress(secondSpender),
      value: 200e6,
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key2 = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key2].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

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

    let biggerSign = selectBiggerSign(
      store.getState().EthereumReducer,
      userAddr,
      await fakeUsdcContract.nonces(userAddr),
      spenderAddr
    );

    // first signature because of the spender
    assert.deepStrictEqual(biggerSign.value.value.toString(), "100000000");

    // get bigger sign of unknown spender
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
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(12.345e6));
    const fakeName = (fakeUsdcContract.name = sinon.fake.resolves("FakeUSDC"));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });
    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply"),
      undefined
    );
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      currentClock: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: { id: 1234, name: "NewChain", rpc: "https://foo-rpc.com/" },
    });
    const now = new Date().getTime();
    await new Promise((r) => setTimeout(r, 0));
    let ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
    });
    assert(now - ethStore.chainState["1234"].call_metadata[call_key].timestamp < 100);
    sinon.assert.calledOnce(fakeTotalSupply);
    assert.ok(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply").eq(Big(12.345))
    );

    store.dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "SecondChain", id: 5678, rpc: "https://foo-rpc.com/" });

    ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.currentChain, {
      id: 5678,
      name: "SecondChain",
      rpc: "https://foo-rpc.com/",
    });

    await store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "name" });
    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "name"),
      undefined
    );
    const call_key_2 = currencyAddress + "_0x06fdde03"; // "06fdde03" == kekac256("name()")
    await new Promise((r) => setTimeout(r, 0));

    ethStore = store.getState().EthereumReducer;
    assert.deepEqual(ethStore.chainState["1234"].calls, {
      [call_key]: {
        state: "LOADED",
        value: Big(12.345),
      },
    });
    assert.deepEqual(ethStore.chainState["5678"].calls, {
      [call_key_2]: {
        state: "LOADED",
        value: "FakeUSDC",
      },
    });

    sinon.assert.calledOnce(fakeTotalSupply);
    sinon.assert.calledOnce(fakeName);
  });
});

describe("All the tests with provider REJECTED Mock", () => {
  beforeEach(() => {
    let rejectedMock = sinon.spy(mock_helper.mockProviderRejectsFn());
    sinon.replaceGetter(ethers, "BrowserProvider", () => rejectedMock);
  });

  test("Rejects eip712 message ETH_EIP_712_SIGN", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    fakeUsdcContract.nonces = sinon.fake.resolves(2);

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
      deadline: deadline,
    };

    await store.dispatch({ type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value });

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "ERROR");
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key].error,
      "Error signing typed message"
    );
  });

  test("Rejects ETH_PLAIN_SIGN with message", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      key: "testPlainKey",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    const key = `testPlainKey_${userAddr}`;
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].signs[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectSign(store.getState().EthereumReducer, "testPlainKey", userAddr);
    assert.deepStrictEqual(sign.state, "ERROR");
    assert.deepStrictEqual(sign.error, "Error signing message");
  });
});
