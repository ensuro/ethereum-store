import React, { useEffect } from "react";
import { Switch, BrowserRouter as Router } from "react-router-dom";
import { useDispatch } from "react-redux";
// Import Routes all
import { userRoutes } from "./routes/allRoutes";
import Middleware from "./routes/middleware/Middleware";

function App() {
  let dispatch = useDispatch();

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "ETH_DISPATCH_CLOCK" });
    }, 500);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <React.Fragment>
      <Router>
        <Switch>
          {userRoutes.map((route, idx) => (
            <Middleware path={route.path} component={route.component} key={idx} exact />
          ))}
        </Switch>
      </Router>
    </React.Fragment>
  );
}

export default App;
