import { combineReducers } from "redux";

import EthereumReducer from "./ethereum/reducer";

// Hack to restore to the empty state dispatching action "RESET_ALL"
// only for tests
let _wrapReducer;

if (process.env.NODE_ENV === "test") {
  _wrapReducer = (reducer) => {
    function resetReducer(state, action) {
      if (action.type === "RESET_ALL") return {};
      return reducer(state, action);
    }
    return resetReducer;
  };
} else {
  _wrapReducer = (reducer) => {
    return reducer;
  };
}

const rootReducer = _wrapReducer(
  combineReducers({
    // public
    EthereumReducer,
  })
);

export default rootReducer;
