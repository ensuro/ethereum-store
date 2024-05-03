import React, { useEffect } from "react";
import { connect, useDispatch } from "react-redux";
import { selectCurrentChain, selectEthCallMultiple } from "../../store/ethereum/selectors";
import { addRemoveEthSub } from "../../utils/helpers/store_helper";

const componentEthCalls = function () {
  // USDC Address
  return [{ address: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", abi: "ERC20", method: "symbol", args: [] }];
};

const SubsManager = ({ symbol, currentChain }) => {
  let dispatch = useDispatch();

  useEffect(() => {
    return addRemoveEthSub(dispatch, "subsManager", componentEthCalls());
  }, [dispatch]);

  return (
    <React.Fragment>
      <h3>Method: symbol</h3>
      {symbol && symbol.value && (
        <>
          <h3>RESULT</h3>
          <h3>{symbol.value.toString()}</h3>
        </>
      )}
    </React.Fragment>
  );
};

const mapStateToProps = (state) => {
  const [symbol] = selectEthCallMultiple(state.EthereumReducer, componentEthCalls());
  const currentChain = selectCurrentChain(state.EthereumReducer);
  return { symbol, currentChain };
};

export default connect(mapStateToProps, null)(SubsManager);
