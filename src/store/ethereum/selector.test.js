import _ from "lodash";
import Big from "big.js";
import store from "../index.js";
import assert from "assert";
import * as mock_helper from "../../helpers/mock_helper";
import * as contractRegistry from "../../helpers/contractRegistry";
import { selectEthCallMultiple, getCallKey } from "./selectors";

const sinon = require("sinon");
const { ethers } = require("ethers");

let contractMock;
const currencyAddress = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // Sepolia USDC address

const BNToDecimal = (number, decimals) => {
  return Big(number).div(10 ** decimals);
};

contractRegistry.registerABI("ERC20Permit", require("@openzeppelin/contracts/build/contracts/ERC20Permit.json").abi);
contractRegistry.registerContract(currencyAddress, "ERC20Permit");
contractRegistry.registerFormatter("ERC20Permit", "totalSupply", _.partial(BNToDecimal, _, 6));
contractRegistry.registerFormatter("ERC20Permit", "balanceOf", _.partial(BNToDecimal, _, 6));

afterEach(() => {
  store.dispatch({ type: "RESET_ALL" });
  sinon.restore();
});

describe("selectEthCallMultiple", () => {
  test("should return call_key", () => {
    const state = {
      currentChain: { id: 1234, rpc: "https://foo-rpc.com/" },
    };

    const expectedEncodedCall = "0x18160ddd";
    sinon.stub(contractRegistry, "getEncodedCall").returns(expectedEncodedCall);

    const callKey = getCallKey(state, currencyAddress, "ERC20Permit", "totalSupply", ...[]);

    expect(callKey).toEqual(`${currencyAddress}_${expectedEncodedCall}`);
  });

  test("should return EMPTYSTATE when no calls are present", async () => {
    await store.dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "NewChain", id: 1234, rpc: "https://foo-rpc.com/" });
    const result = selectEthCallMultiple(store.getState().EthereumReducer, []);
    expect(result).toEqual([]);
  });

  test("should return the corresponding calls when present with actions", async () => {
    const call_key = getCallKey(
      { currentChain: { id: 1234, rpc: "https://foo-rpc.com/" } },
      currencyAddress,
      "ERC20Permit",
      "totalSupply",
      ...[]
    );
    store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    let result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
    ]);
    expect(result).toEqual([{ state: "LOADING" }]);

    store.dispatch({ type: "ETH_CALL_SUCCESS", call_key: call_key, value: 1000, timestamp: new Date().getTime() });
    result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
    ]);
    expect(result).toEqual([{ state: "LOADED", value: 1000 }]);
    let result2 = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
    ]);
    assert.strictEqual(result[0], result2[0]);
  });

  test("should handle multiple calls with different states", async () => {
    const totalSupplyCallKey = getCallKey(
      { currentChain: { id: 1234, rpc: "https://foo-rpc.com/" } },
      currencyAddress,
      "ERC20Permit",
      "totalSupply",
      ...[]
    );

    const balanceOfCallKey = getCallKey(
      { currentChain: { id: 1234, rpc: "https://foo-rpc.com/" } },
      currencyAddress,
      "ERC20Permit",
      "balanceOf",
      "0x4d68Cf31d613070b18E406AFd6A42719a62a0785"
    );

    store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    store.dispatch({
      type: "ETH_CALL",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "balanceOf",
      args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785"],
    });
    let result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
      {
        address: currencyAddress,
        abi: "ERC20Permit",
        method: "balanceOf",
        args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785"],
      },
    ]);
    expect(result).toEqual([{ state: "LOADING" }, { state: "LOADING" }]);

    store.dispatch({
      type: "ETH_CALL_SUCCESS",
      call_key: totalSupplyCallKey,
      value: 1000,
      timestamp: new Date().getTime(),
    });

    result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
      {
        address: currencyAddress,
        abi: "ERC20Permit",
        method: "balanceOf",
        args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785"],
      },
    ]);

    expect(result).toEqual([{ state: "LOADED", value: 1000 }, { state: "LOADING" }]);

    store.dispatch({
      type: "ETH_CALL_SUCCESS",
      call_key: balanceOfCallKey,
      value: 500,
      timestamp: new Date().getTime(),
    });

    result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
      {
        address: currencyAddress,
        abi: "ERC20Permit",
        method: "balanceOf",
        args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785"],
      },
    ]);

    expect(result).toEqual([
      { state: "LOADED", value: 1000 },
      { state: "LOADED", value: 500 },
    ]);
  });

  test("should replace existing call value with new value", async () => {
    const call_key = getCallKey(
      { currentChain: { id: 1234, rpc: "https://foo-rpc.com/" } },
      currencyAddress,
      "ERC20Permit",
      "totalSupply",
      ...[]
    );

    store.dispatch({ type: "ETH_CALL", address: currencyAddress, abi: "ERC20Permit", method: "totalSupply" });

    store.dispatch({ type: "ETH_CALL_SUCCESS", call_key: call_key, value: 1000, timestamp: new Date().getTime() });

    let result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
    ]);

    expect(result).toEqual([{ state: "LOADED", value: 1000 }]);

    store.dispatch({ type: "ETH_CALL_SUCCESS", call_key: call_key, value: 2000, timestamp: new Date().getTime() });

    result = selectEthCallMultiple(store.getState().EthereumReducer, [
      { address: currencyAddress, abi: "ERC20Permit", method: "totalSupply", args: [] },
    ]);

    expect(result).toEqual([{ state: "LOADED", value: 2000 }]);

    expect(result[0].value).not.toBe(1000);
  });
});
