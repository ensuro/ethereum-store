import React, { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { connect } from "react-redux";
import { selectCurrentChain, selectEthCallMultiple } from "../../store/ethereum/selectors";

const componentEthCalls = function () {
  return [
    {
      address: "0x280A556d9AEeF50725756f1C020e32FE137C3516", // USDC Address
      abi: "ERC20",
      method: "symbol",
      args: [],
    },
  ];
};

const SubsManager = ({ symbol, currentChain }) => {
  let dispatch = useDispatch();
  const mounted = useRef(false);

  // Initial useEffects
  useEffect(() => {
    mounted.current = true;
    dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "subsManager",
      componentEthCalls: componentEthCalls(),
    });
    return () => {
      dispatch({ type: "ETH_REMOVE_SUBSCRIPTION", key: "subsManager" });
      mounted.current = false;
    };
  }, [dispatch, currentChain]);

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
