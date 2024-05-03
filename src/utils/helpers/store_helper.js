export function addRemoveEthSub(dispatch, key, ethCalls) {
  dispatch({ type: "ETH_ADD_SUBSCRIPTION", key: key, componentEthCalls: ethCalls });
  return () => {
    dispatch({ type: "ETH_REMOVE_SUBSCRIPTION", key: key });
  };
}
