export { ethereumSaga } from "./store/ethereum/saga";

export {
  selectEthCall,
  selectEthCallTimestamp,
  selectEthCallTimestampByKey,
  selectEthCallState,
  selectEthCallMultiple,
  selectLastTransact,
  selectBiggerSign,
  selectSign,
  selectEthSiweSign,
} from "./store/ethereum/selectors";

// Helpers
let getEncodedCallFn;
let getContractFn;
let getABIFn;
let getAbiNameFn;
let getFormatterFn;
let getSignerContractFn;
let getTxReceiptStatusFn;

// User
let selectUserAddressFn;
let selectChainIdFn;
let selectProviderFn;

// Chain
let envChain;

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
    chain,
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
  envChain = chain;
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
  envChain,
};
