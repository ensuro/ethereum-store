import React, { useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch } from "react-redux";
// Import Routes all
import { userRoutes } from "./routes/allRoutes";

function App() {
  let dispatch = useDispatch();
  const mounted = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "ETH_DISPATCH_CLOCK" });
    }, 500);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Initial useEffects
  useEffect(() => {
    mounted.current = true;
    dispatch({ type: "SET_USER_CURRENT_CHAIN", name: "Mumbai", id: 80001, rpc: "https://rpc.ankr.com/polygon_mumbai" });
    return () => {
      mounted.current = false;
    };
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
