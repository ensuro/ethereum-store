export function addRemoveEthSub(dispatch, key, ethCalls, clockCount) {
  dispatch({ type: "ETH_ADD_SUBSCRIPTION", key: key, componentEthCalls: ethCalls, clockCount: clockCount });
  return () => {
    dispatch({ type: "ETH_REMOVE_SUBSCRIPTION", key: key });
  };
}
