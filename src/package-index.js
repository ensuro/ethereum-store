export { ethereumSaga } from "./store/ethereum/saga";

// Helpers
let getEncodedCallFn;
let getContractFn;
let getABIFn;
let getAbiNameFn;
let getFormatterFn;
let getSignerContractFn;
let getTxReceiptStatusFn;
let defaultClock;

// User
let selectUserAddressFn;
let selectChainIdFn;
let selectProviderFn;

export function initializeEthereumStore(options) {
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

  getEncodedCallFn = getEncodedCall;
  getContractFn = getContract;
  getABIFn = getABI;
  getAbiNameFn = getAbiName;
  getFormatterFn = getFormatter;
  getSignerContractFn = getSignerContract;
  getTxReceiptStatusFn = getTxReceiptStatus;
  selectUserAddressFn = selectUserAddress;
  selectChainIdFn = selectChainId;
  selectProviderFn = selectProvider;
  defaultClock = clockCount || 10;
}

export {
  getEncodedCallFn,
  getContractFn,
  getABIFn,
  getAbiNameFn,
  getFormatterFn,
  getSignerContractFn,
  getTxReceiptStatusFn,
  selectUserAddressFn,
  selectChainIdFn,
  selectProviderFn,
  defaultClock,
};
