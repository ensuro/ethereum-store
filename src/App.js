import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch } from "react-redux";
// Import Routes all
import { userRoutes } from "./routes/allRoutes";

function App() {
  let dispatch = useDispatch();

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "ETH_DISPATCH_CLOCK" });
    }, 500);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Initial useEffects
  useEffect(() => {
    const rpc = "https://ethereum-sepolia-rpc.publicnode.com";
    dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "Sepolia", id: 11155111, rpc: rpc });
  }, [dispatch]);

  return (
    <React.Fragment>
      <Routes>
        {userRoutes.map((route) => (
          <Route path={route.path} key={route.path} element={<route.component />} />
        ))}
      </Routes>
    </React.Fragment>
  );
}

export default App;
