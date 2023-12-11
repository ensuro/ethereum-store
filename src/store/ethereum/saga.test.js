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
  selectEthSiweSign,
} from "./selectors";
import { ethereum } from "../../config";

const sinon = require("sinon");
const { ethers, BigNumber } = require("ethers");

let contractMock;
let providerMock;
const currencyAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC address

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

beforeEach(() => {
  store.dispatch({ type: "RESET_ALL" });
  contractMock = sinon.spy(mock_helper.mockContractFn());
  sinon.replaceGetter(ethers, "Contract", () => contractMock);

  fakeUsdcContract = { interface: usdcContract.interface };
  contractMock.byAddress(currencyAddress, fakeUsdcContract);
  contractRegistry.registerContract(currencyAddress, "ERC20Permit");
});

afterEach(() => {
  store.dispatch({ type: "RESET_ALL" });
  sinon.restore();
});

describe("All the test with provider resolver mock", () => {
  beforeEach(() => {
    providerMock = sinon.spy(mock_helper.mockProviderFn());
    sinon.replaceGetter(ethers.providers, "Web3Provider", () => providerMock);
  });

  test("ETH_ADD_SUBSCRIPTION and ETH_DISPATCH_CLOCK with one ethCall", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(12.345e6)));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "totalSupplyComponent",
      componentEthCalls: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
    });

    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(12.345e6)));
    const fakeName = (fakeUsdcContract.name = sinon.fake.resolves("Peso"));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });

    await store.dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "totalSupplyComponent",
      componentEthCalls: [
        { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
        { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
      ],
    });

    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: [
              { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
              { address: currencyAddress, abi: "ERC20Permit", method: "name", args: [] },
            ],
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(12.345e6)));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });

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
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          subscriptions: {
            totalSupplyComponent: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
            secondComponent: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
      totalSupplyComponent: [{ address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] }],
    });
  });

  test("ETH_CALL with simple method", async () => {
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(12.345e6)));
    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });

    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
    });
    assert.strictEqual(
      selectEthCall(store.getState().EthereumReducer, currencyAddress, "ERC20Permit", "totalSupply"),
      undefined
    );
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });

    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "name",
    });
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x06fdde03"; // "06fdde03" == kekac256("name()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
    const fakeBalanceOf = (fakeUsdcContract.balanceOf = sinon.fake.resolves(ethers.BigNumber.from(78.345678e6)));
    assert.strictEqual(ethers.Contract.callCount, 1);
    const addr = "0x4d68cf31d613070b18e406afd6a42719a62a0785";

    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
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
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
    });
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
    });
    await new Promise((r) => setTimeout(r, 100));
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
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
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
    });
  });

  test("ETH_CALL with retries", async () => {
    sinon.replace(ethereum, "retry", { timeout: 10, count: 5 });
    const fakeTotalSupply = (fakeUsdcContract.totalSupply = sinon.fake.rejects("Error"));
    assert.strictEqual(ethers.Contract.callCount, 1);
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
    });
    assert.strictEqual(ethers.Contract.callCount, 1);
    const call_key = currencyAddress + "_0x18160ddd"; // "18160ddd" == kekac256("totalSupply()")
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
      chainState: {
        1234: {
          calls: {
            [call_key]: {
              state: "LOADING",
            },
          },
        },
      },
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
    });
    await new Promise((r) => setTimeout(r, 15));
    fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(123.2e6));
    assert.deepStrictEqual(store.getState().EthereumReducer, {
      transacts: [],
      timestamp: 0,
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
      currentChain: {
        id: 1234,
        name: "NewChain",
      },
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
    const fakeEstimateGas = (fakeUsdcContract["estimateGas"] = {
      approve: sinon.fake.resolves(BigNumber.from(100000)),
    });
    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.resolves(txStatus),
      selectChainId: () => 80001, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
      // just for testing
      chain: {
        id: 80001,
        rpc: "https://matic-mumbai.chainstacklabs.com/",
      },
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", ethers.BigNumber.from(10)],
    });

    const id = store.getState().EthereumReducer.transacts.length - 1;
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "QUEUED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
    await new Promise((r) => setTimeout(r, 1000));

    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas["approve"], 1);

    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "MINED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
  });

  test("ETH_TRANSACT reverted", async () => {
    const txHash = "0x000001";
    const txStatus = 0; // 0 == reverted
    const fakeApprove = (fakeUsdcContract.approve = sinon.fake.resolves({ hash: txHash })); //TxHash
    const fakeEstimateGas = (fakeUsdcContract["estimateGas"] = {
      approve: sinon.fake.resolves(BigNumber.from(100000)),
    });

    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.resolves(txStatus),
      selectChainId: () => 80001, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
      // just for testing
      chain: {
        id: 80001,
        rpc: "https://matic-mumbai.chainstacklabs.com/",
      },
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", ethers.BigNumber.from(10)],
    });

    const id = store.getState().EthereumReducer.transacts.length - 1;
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "QUEUED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
    await new Promise((r) => setTimeout(r, 1001));

    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas["approve"], 1);
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "REVERTED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
  });

  test("ETH_TRANSACT rejected", async () => {
    const txHash = "0x000001";
    const txStatus = 0; // 0 == reverted
    const fakeApprove = (fakeUsdcContract.approve = sinon.fake.resolves({ hash: txHash })); //TxHash
    const fakeEstimateGas = (fakeUsdcContract["estimateGas"] = {
      approve: sinon.fake.resolves(BigNumber.from(100000)),
    });

    /* Mocking tx receipt function and initialize saga */
    initializeEthereumStore({
      getEncodedCall: contractRegistry.getEncodedCall,
      getContract: contractRegistry.getContract,
      getAbiName: contractRegistry.getAbiName,
      getFormatter: contractRegistry.getFormatter,
      getSignerContract: contractRegistry.getSignerContract,
      getTxReceiptStatus: sinon.fake.rejects(txStatus),
      selectChainId: () => 80001, // just for testing
      selectProvider: () => {},
      selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
      // just for testing
      chain: {
        id: 80001,
        rpc: "https://matic-mumbai.chainstacklabs.com/",
      },
    });

    assert.strictEqual(ethers.Contract.callCount, 1);

    await store.dispatch({
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "approve",
      args: ["0x01", ethers.BigNumber.from(10)],
    });

    const id = store.getState().EthereumReducer.transacts.length - 1;
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].method, "approve");
    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "QUEUED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
    await new Promise((r) => setTimeout(r, 1001));

    sinon.assert.callCount(fakeApprove, 1);
    sinon.assert.callCount(fakeEstimateGas["approve"], 1);
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].state, "REJECTED");
    assert.deepStrictEqual(store.getState().EthereumReducer.transacts[id].txHash, txHash);
  });

  test("ETH_CALL method with timestamp", async () => {
    fakeUsdcContract.totalSupply = sinon.fake.resolves(ethers.BigNumber.from(12.345e6));
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
    await store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "totalSupply",
    });
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
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].signs[userAddr].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectSign(store.getState().EthereumReducer, [userAddr]);
    assert.deepStrictEqual(sign.state, "SIGNED");
    assert.deepStrictEqual(sign.signature, "0x1234567890");
    assert.deepStrictEqual(sign.message, "Simple example of plain text");
  });

  test("ETH_SIWE_SIGN resolves", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const whitelistAddr = "0x99b2949F4b12bF14F9AD66De374Cd5A2BF6a0C15";
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_SIWE_SIGN",
      userAddress: userAddr,
      message: "I accept the Ensuro Terms of Service: https://ensuro.co/Ensuro_ToS.pdf....",
      email: "test@test.com",
      country: "Argentina",
      occupation: "Developer",
      whitelist: whitelistAddr,
    });

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].siweSigns[userAddr].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectEthSiweSign(store.getState().EthereumReducer, [userAddr]);
    assert.deepStrictEqual(sign.state, "SIGNED");
    assert.deepStrictEqual(sign.signature, "0x1234567890");
    assert.deepStrictEqual(sign.message, "I accept the Ensuro Terms of Service: https://ensuro.co/Ensuro_ToS.pdf....");
  });

  test("Signed eip712 message ETH_EIP_712_SIGN", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    fakeUsdcContract.nonces = sinon.fake.resolves(2);
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    const usdcDomain = {
      name: "USDC",
      version: "1",
      chainId: 8001,
      verifyingContract: currencyAddress,
    };

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
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(spenderAddr),
      value: ethers.BigNumber.from(100e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
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
    fakeUsdcContract.nonces = sinon.fake.resolves(BigNumber.from(2));
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    const usdcDomain = {
      name: "USDC",
      version: "1",
      chainId: 8001,
      verifyingContract: currencyAddress,
    };

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
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(spenderAddr),
      value: ethers.BigNumber.from(100e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);

    value = {
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(spenderAddr),
      value: ethers.BigNumber.from(200e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key2 = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
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
    fakeUsdcContract.nonces = sinon.fake.resolves(BigNumber.from(2));
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    const usdcDomain = {
      name: "USDC",
      version: "1",
      chainId: 8001,
      verifyingContract: currencyAddress,
    };

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
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(spenderAddr),
      value: ethers.BigNumber.from(100e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].state, "SIGNED");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].signature, "0x0987654321");
    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value, value);
    assert.deepStrictEqual(
      store.getState().EthereumReducer.chainState["1234"].eipSigns[key].value.spender,
      ethers.utils.getAddress(spenderAddr)
    );

    // second spender
    value = {
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(secondSpender),
      value: ethers.BigNumber.from(200e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key2 = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
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
      ethers.utils.getAddress(secondSpender)
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
});

describe("All the tests with provider REJECTED Mock", () => {
  beforeEach(() => {
    let rejectedMock = sinon.spy(mock_helper.mockProviderRejectsFn());
    sinon.replaceGetter(ethers.providers, "Web3Provider", () => rejectedMock);
  });

  test("Rejects eip712 message ETH_EIP_712_SIGN", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    fakeUsdcContract.nonces = sinon.fake.resolves(2);

    const usdcDomain = {
      name: "USDC",
      version: "1",
      chainId: 8001,
      verifyingContract: currencyAddress,
    };

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
      owner: ethers.utils.getAddress(userAddr),
      spender: ethers.utils.getAddress(spenderAddr),
      value: ethers.BigNumber.from(100e6),
      nonce: await fakeUsdcContract.nonces(userAddr),
      deadline: deadline,
    };

    await store.dispatch({
      type: "ETH_EIP_712_SIGN",
      domain: usdcDomain,
      types: types,
      value: value,
    });

    const key = ethers.utils._TypedDataEncoder.encode(usdcDomain, types, value);
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
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_PLAIN_SIGN",
      message: "Simple example of plain text",
      userAddress: userAddr,
    });

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].signs[userAddr].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectSign(store.getState().EthereumReducer, [userAddr]);
    assert.deepStrictEqual(sign.state, "ERROR");
    assert.deepStrictEqual(sign.error, "Error signing message");
  });

  test("Rejects ETH_SIWE_SIGN", async () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const whitelistAddr = "0x99b2949F4b12bF14F9AD66De374Cd5A2BF6a0C15";
    await store.dispatch({
      type: "SET_USER_CURRENT_CHAIN",
      name: "NewChain",
      id: 1234,
    });
    await store.dispatch({
      type: "ETH_SIWE_SIGN",
      userAddress: userAddr,
      message: "I accept the Ensuro Terms of Service: https://ensuro.co/Ensuro_ToS.pdf....",
      email: "test@test.com",
      country: "Argentina",
      occupation: "Developer",
      whitelist: whitelistAddr,
    });

    assert.deepStrictEqual(store.getState().EthereumReducer.chainState["1234"].siweSigns[userAddr].state, "PENDING");

    await new Promise((r) => setTimeout(r, 0));

    const sign = selectEthSiweSign(store.getState().EthereumReducer, [userAddr]);
    assert.deepStrictEqual(sign.state, "ERROR");
    assert.deepStrictEqual(sign.error, "Error signing message");
  });
});
