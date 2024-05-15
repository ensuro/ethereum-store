import EthereumReducer from "./reducer.js";
import { initializeEthereumStore } from "../../package-index";
import * as contractRegistry from "../../helpers/contractRegistry";

const { ethers } = require("ethers");

const currencyAddress = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // Sepolia USDC address
contractRegistry.registerABI("ERC20Permit", require("@openzeppelin/contracts/build/contracts/ERC20Permit.json").abi);
contractRegistry.registerContract(currencyAddress, "ERC20Permit");
contractRegistry.registerFormatter("ERC20Permit", "totalSupply", undefined);
contractRegistry.registerFormatter("ERC20Permit", "name", undefined);

describe("Ethereum Reducer tests", () => {
  /* Mocking tx receipt function and initialize saga */
  initializeEthereumStore({
    getEncodedCall: contractRegistry.getEncodedCall,
    getContract: contractRegistry.getContract,
    getAbiName: contractRegistry.getAbiName,
    getFormatter: contractRegistry.getFormatter,
    getSignerContract: contractRegistry.getSignerContract,
    getTxReceiptStatus: () => 1, // just for testing
    selectChainId: () => 1234, // just for testing
    selectProvider: () => {},
    selectUserAddress: () => "0x4d68Cf31d613070b18E406AFd6A42719a62a0785", // just for testing
  });

  const state = {
    currentClock: 0,
    currentChain: { name: "Sepolia", id: 11155111, rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
    chainState: {},
  };

  it("Should handle initial state", () => {
    const initialState = state;
    const action = { type: "fake_action" };
    const expectedState = initialState;
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should SET_USER_CURRENT_CHAIN", () => {
    const initialState = { ...state };
    const action = { type: "SET_USER_CURRENT_CHAIN", name: "NewChain", id: 1234, rpc: "https://foo-rpc.com/" };
    const expectedState = { ...state, currentChain: { name: "NewChain", id: 1234, rpc: "https://foo-rpc.com/" } };

    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one subscription", () => {
    const initialState = { ...state, chainState: { 11155111: { subscriptions: {} } } };
    const action = {
      type: "ETH_ADD_SUBSCRIPTION",
      key: "foo",
      componentEthCalls: [{ address: "0x00", abi: "ERC20Permit", method: "totalSupply", args: [] }],
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          subscriptions: {
            foo: {
              functions: [{ address: "0x00", abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 10,
              nextClock: 0,
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should remove one subscription", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          subscriptions: {
            foo: {
              functions: [{ address: "0x00", abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 10,
              nextClock: 0,
            },
          },
        },
      },
    };
    const action = { type: "ETH_REMOVE_SUBSCRIPTION", key: "foo" };
    const expectedState = { ...state, chainState: { 11155111: { subscriptions: {} } } };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add new subscription", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          subscriptions: {
            foo: {
              functions: [{ address: "0x00", abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 10,
              nextClock: 0,
            },
          },
        },
      },
    };
    const action = {
      type: "ETH_ADD_SUBSCRIPTION",
      key: "bar",
      componentEthCalls: [{ address: "0x01", abi: "ERC20Permit", method: "name", args: [] }],
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          subscriptions: {
            foo: {
              functions: [{ address: "0x00", abi: "ERC20Permit", method: "totalSupply", args: [] }],
              clockCount: 10,
              nextClock: 0,
            },
            bar: {
              functions: [{ address: "0x01", abi: "ERC20Permit", method: "name", args: [] }],
              clockCount: 10,
              nextClock: 0,
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one ETH_CALL", () => {
    const initialState = { ...state, chainState: { 11155111: { calls: {} } } };
    const action = { type: "ETH_CALL", address: "0x00", abi: "ERC20Permit", method: "name", args: [] };
    const expectedState = {
      ...state,
      chainState: { 11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING" } } } },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one ETH_CALL and there is already another one", () => {
    const initialState = { ...state, chainState: { 11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING" } } } } };
    const action = {
      type: "ETH_CALL",
      address: "0x00",
      abi: "ERC20Permit",
      method: "totalSupply",
      args: [],
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING" }, "0x00_0x18160ddd": { state: "LOADING" } } },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should retry the ETH_CALL", () => {
    const initialState = { ...state, chainState: { 11155111: { calls: {} } } };
    const action = {
      type: "ETH_CALL",
      address: "0x00",
      abi: "ERC20Permit",
      method: "name",
      args: [],
      retry: 5,
    };
    const expectedState = {
      ...state,
      chainState: { 11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING", retries: 5 } } } },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("The ETH_CALL was successful", () => {
    const initialState = { ...state, chainState: { 11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING" } } } } };
    const action = {
      type: "ETH_CALL_SUCCESS",
      call_key: "0x00_0x06fdde03",
      value: "FakeUSDC",
      timestamp: 1703683845252,
    };

    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          calls: { "0x00_0x06fdde03": { state: "LOADED", value: "FakeUSDC" } },
          call_metadata: { "0x00_0x06fdde03": { timestamp: 1703683845252 } },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("The ETH_CALL was successful and there is already another one", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          calls: { "0x00_0x06fdde03": { state: "LOADED", value: "FakeUSDC" }, "0x00_0x18160ddd": { state: "LOADING" } },
          call_metadata: { "0x00_0x06fdde03": { timestamp: 1703683845252 } },
        },
      },
    };
    const action = { type: "ETH_CALL_SUCCESS", call_key: "0x00_0x18160ddd", value: 100, timestamp: 1703683849000 };

    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          calls: {
            "0x00_0x06fdde03": { state: "LOADED", value: "FakeUSDC" },
            "0x00_0x18160ddd": { state: "LOADED", value: 100 },
          },
          call_metadata: {
            "0x00_0x06fdde03": { timestamp: 1703683845252 },
            "0x00_0x18160ddd": { timestamp: 1703683849000 },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("The ETH_CALL fails", () => {
    const initialState = {
      ...state,
      chainState: { 11155111: { calls: { "0x00_0x06fdde03": { state: "LOADING", retries: 9 } } } },
    };
    const action = { type: "ETH_CALL_FAIL", payload: "eth call fails", call_key: "0x00_0x06fdde03" };

    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          calls: { "0x00_0x06fdde03": { state: "ERROR", retries: 9 } },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one ETH_TRANSACT", () => {
    const initialState = { ...state, chainState: { 11155111: { transacts: [] } } };
    const action = {
      type: "ETH_TRANSACT",
      address: currencyAddress,
      abi: "ERC20Permit",
      method: "deposit",
      args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Queued the ETH_TRANSACT", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
            },
          ],
        },
      },
    };
    const action = { type: "ETH_TRANSACT_QUEUED", id: 0, txHash: "0x1234567890" };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "QUEUED",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Reject the ETH_TRANSACT", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
            },
          ],
        },
      },
    };
    const action = { type: "ETH_TRANSACT_REJECTED", id: 0, payload: "user rejects the transaction" };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              error: "user rejects the transaction",
              state: "REJECTED",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Mined the ETH_TRANSACT", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "QUEUED",
            },
          ],
        },
      },
    };
    const action = { type: "ETH_TRANSACT_MINED", id: 0 };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "MINED",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Revert the ETH_TRANSACT", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "QUEUED",
            },
          ],
        },
      },
    };
    const action = { type: "ETH_TRANSACT_REVERTED", id: 0 };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "REVERTED",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Expire the ETH_TRANSACT", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "QUEUED",
            },
          ],
        },
      },
    };
    const action = { type: "ETH_TRANSACT_EXPIRED", id: 0 };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          transacts: [
            {
              address: currencyAddress,
              args: ["0x4d68Cf31d613070b18E406AFd6A42719a62a0785", 100000000],
              method: "deposit",
              txHash: "0x1234567890",
              state: "EXPIRED",
            },
          ],
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("ETH_PLAIN_SIGN should fail", () => {
    const initialState = {
      ...state,
      chainState: {
        11155111: { signs: { testPlainSign_0x4d68Cf31d613070b18E406AFd6A42719a62a0785: { state: "PENDING" } } },
      },
    };
    const action = {
      type: "ETH_PLAIN_SIGN_FAILED",
      key: "testPlainSign",
      userAddress: "0x4d68Cf31d613070b18E406AFd6A42719a62a0785",
      payload: "Error in the signature",
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          signs: {
            testPlainSign_0x4d68Cf31d613070b18E406AFd6A42719a62a0785: {
              state: "ERROR",
              error: "Error in the signature",
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one ETH_EIP_712_SIGN", () => {
    const initialState = { ...state, chainState: { 11155111: { eipSigns: {} } } };
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
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
      nonce: 10,
      deadline: deadline,
    };
    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const action = { type: "ETH_EIP_712_SIGN", domain: usdcDomain, types: types, value: value };

    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    const expectedState = { ...state, chainState: { 11155111: { eipSigns: { [key]: { state: "PENDING" } } } } };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Proccess the ETH_EIP_712_SIGN", () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
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
      nonce: 10,
      deadline: deadline,
    };
    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    const initialState = { ...state, chainState: { 11155111: { eipSigns: { [key]: { state: "PENDING" } } } } };
    const action = {
      type: "ETH_EIP_712_SIGN_PROCESSED",
      key: key,
      userAddress: ethers.getAddress(userAddr),
      signature: "0xabcd12345",
      domain: usdcDomain,
      types: types,
      value: value,
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          eipSigns: {
            [key]: {
              state: "SIGNED",
              signature: "0xabcd12345",
              types: types,
              domain: usdcDomain,
              userAddress: ethers.getAddress(userAddr),
              value: value,
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("The ETH_EIP_712_SIGN failed", () => {
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const spenderAddr = "0x78f1626224f48A4E24FD7Cc7bF070A1740D5cafD"; // receive money address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
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
      nonce: 10,
      deadline: deadline,
    };
    const usdcDomain = { name: "USDC", version: "1", chainId: 11155111, verifyingContract: currencyAddress };
    const key = ethers.TypedDataEncoder.encode(usdcDomain, types, value);
    const initialState = { ...state, chainState: { 11155111: { eipSigns: { [key]: { state: "PENDING" } } } } };
    const action = {
      type: "ETH_EIP_712_SIGN_FAILED",
      key: key,
      userAddress: ethers.getAddress(userAddr),
      payload: "error processing the sign",
    };
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          eipSigns: {
            [key]: {
              state: "ERROR",
              error: "error processing the sign",
              userAddress: ethers.getAddress(userAddr),
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Should add one ETH_PLAIN_SIGN", () => {
    const initialState = { ...state, chainState: { 11155111: { signs: {} } } };
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const action = {
      type: "ETH_PLAIN_SIGN",
      key: "testPlainSign",
      message: "Please sign this message",
      userAddress: userAddr,
    };

    const key = `${action.key}_${userAddr}`;
    const expectedState = { ...state, chainState: { 11155111: { signs: { [key]: { state: "PENDING" } } } } };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });

  it("Proccess the ETH_PLAIN_SIGN", () => {
    const initialState = { ...state, chainState: { 11155111: { signs: {} } } };
    const userAddr = "0x4d68Cf31d613070b18E406AFd6A42719a62a0785";
    const action = {
      type: "ETH_PLAIN_SIGN_PROCESSED",
      key: "testPlainSign",
      userAddress: userAddr,
      signature: "0xabcd1234",
      message: "Please sign this message",
    };

    const key = `${action.key}_${userAddr}`;
    const expectedState = {
      ...state,
      chainState: {
        11155111: {
          signs: {
            [key]: {
              state: "SIGNED",
              userAddress: userAddr,
              signature: "0xabcd1234",
              message: "Please sign this message",
            },
          },
        },
      },
    };
    expect(EthereumReducer(initialState, action)).toEqual(expectedState);
  });
});
