export { ethereumSaga } from "./store/ethereum/saga.js";
export { default as EthereumReducer } from "./store/ethereum/reducer.js";

export * from "./store/ethereum/actionTypes.js";
export * from "./store/ethereum/selectors.js";

export { registerABI, registerContract, registerFormatter } from "./helpers/contractRegistry.js";

export { addRemoveEthSub } from "./utils/helpers/store_helper.js";

export let getEncodedCallFn;
export let getContractFn;
export let getABIFn;
export let getAbiNameFn;
export let getFormatterFn;
export let getSignerContractFn;
export let getTxReceiptStatusFn;

export let selectUserAddressFn;
export let selectChainIdFn;
export let selectProviderFn;

export let defaultClock = 10;

export function initializeEthereumStore(options = {}) {
  const {
    getEncodedCall,
    getContract,
    getABI,
    getAbiName,
    getFormatter,
    getSignerContract,
    getTxReceiptStatus,

    selectUserAddress,
    selectChainId,
    selectProvider,

    clockCount,
  } = options;

  if (getEncodedCall) getEncodedCallFn = getEncodedCall;
  if (getContract) getContractFn = getContract;
  if (getABI) getABIFn = getABI;
  if (getAbiName) getAbiNameFn = getAbiName;
  if (getFormatter) getFormatterFn = getFormatter;
  if (getSignerContract) getSignerContractFn = getSignerContract;
  if (getTxReceiptStatus) getTxReceiptStatusFn = getTxReceiptStatus;

  if (selectUserAddress) selectUserAddressFn = selectUserAddress;
  if (selectChainId) selectChainIdFn = selectChainId;
  if (selectProvider) selectProviderFn = selectProvider;

  if (clockCount !== undefined) defaultClock = clockCount;
}

export {
  getEncodedCallFn as getEncodedCall,
  getContractFn as getContract,
  getABIFn as getABI,
  getAbiNameFn as getAbiName,
  getFormatterFn as getFormatter,
  getSignerContractFn as getSignerContract,
  getTxReceiptStatusFn as getTxReceiptStatus,
  selectUserAddressFn as selectUserAddress,
  selectChainIdFn as selectChainId,
  selectProviderFn as selectProvider,
};
