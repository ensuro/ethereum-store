import logo from "./logo.svg";
import "./App.css";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

function App() {
  let dispatch = useDispatch();

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "ETH_DISPATCH_CLOCK" });
    }, 500);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
