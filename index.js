export { ethereumSaga } from "./saga";
export { EthereumReducer } from "./reducer";
export {
  selectEthCall,
  selectEthCallTimestamp,
  selectEthCallTimestampByKey,
  selectEthCallState,
  selectEthCallMultiple,
  selectLastTransact,
  selectBiggerSign,
} from "./selectors";

// Helpers
let getEncodedCallFn;
let getContractFn;
let getAbiNameFn;
let getFormatterFn;
let getSignerContractFn;
let getTxReceiptStatusFn;

// User
let selectUserAddressFn;
let selectChainIdFn;
let selectProviderFn;

export function initializeEthereumStore(options) {
  const {
    getEncodedCall,
    getContract,
    getAbiName,
    getFormatter,
    getSignerContract,
    getTxReceiptStatus,
    selectUserAddress,
    selectChainId,
    selectProvider,
  } = options;

  getEncodedCallFn = getEncodedCall;
  getContractFn = getContract;
  getAbiNameFn = getAbiName;
  getFormatterFn = getFormatter;
  getSignerContractFn = getSignerContract;
  getTxReceiptStatusFn = getTxReceiptStatus;
  selectUserAddressFn = selectUserAddress;
  selectChainIdFn = selectChainId;
  selectProviderFn = selectProvider;
}

export {
  getEncodedCallFn,
  getContractFn,
  getAbiNameFn,
  getFormatterFn,
  getSignerContractFn,
  getTxReceiptStatusFn,
  selectUserAddressFn,
  selectChainIdFn,
  selectProviderFn,
};
