import { all, fork } from "redux-saga/effects";
import {
  ethereumSaga,
  initializeEthereumStore,
  getEncodedCall,
  getContract,
  getAbiName,
  getFormatter,
  getSignerContract,
  getTxReceiptStatus,
} from "@ensuro/ethereum-store";

initializeEthereumStore({
  getEncodedCall,
  getContract,
  getAbiName,
  getFormatter,
  getSignerContract,
  getTxReceiptStatus,
  selectChainId: () => 11155111, // just for testing
  selectProvider: () => {},
  selectUserAddress: () => "0x4d68cf31d613070b18e406afd6a42719a62a0785", // just for testing
  clockCount: 15,
});

export default function* rootSaga() {
  yield all([
    //public
    fork(ethereumSaga),
  ]);
}
