import React, { useEffect, useRef, useState } from "react";
import _ from "lodash";
import { map } from "lodash";
import { Container } from "reactstrap";
import { Button } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { connect } from "react-redux";
import { selectEthCallMultiple } from "../../package-index";
import SubsManager from "./subsManager";

const componentEthCalls = function () {
  return [
    {
      address: "0x280A556d9AEeF50725756f1C020e32FE137C3516", // USDC Address
      abi: "ERC20",
      method: "totalSupply",
      args: [],
    },
  ];
};

const Static = ({ totalSupply, subscriptions }) => {
  let dispatch = useDispatch();
  const [sub, setSub] = useState(false);
  const mounted = useRef(false);

  // Initial useEffects
  useEffect(() => {
    mounted.current = true;
    dispatch({
      type: "ETH_ADD_SUBSCRIPTION",
      key: "staticDashboard",
      componentEthCalls: componentEthCalls(),
    });
    return () => {
      dispatch({ type: "ETH_REMOVE_SUBSCRIPTION", key: "staticDashboard" });
      mounted.current = false;
    };
  }, [dispatch]);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <h1>Dashboard to see ETH Subscriptions on eToken KYC Sr</h1>
          <h3>Contract Address: 0x280A556d9AEeF50725756f1C020e32FE137C3516</h3>

          <hr />
          <h3>Method: totalSupply</h3>
          {totalSupply && totalSupply.value && (
            <>
              <h3>RESULT</h3>
              <h3>{totalSupply.value.toString()}</h3>
            </>
          )}

          {sub && (
            <>
              <hr />
              <SubsManager />
            </>
          )}

          <hr />
          {!_.isEmpty(subscriptions) && (
            <>
              <h4>Subscriptions: </h4>
              {map(Object.keys(subscriptions), (key) => (
                <React.Fragment key={key}>
                  <p>{key}</p>
                  {subscriptions[key].map((s, idx) => (
                    <React.Fragment key={idx}>
                      <li>Address: {s.address}</li>
                      <li>ABI: {s.abi}</li>
                      <li>Method: {s.method}</li>
                      <br />
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </>
          )}

          {sub ? (
            <Button onClick={() => setSub(false)}> Remove Subscription</Button>
          ) : (
            <Button onClick={() => setSub(true)}> Add Subscription</Button>
          )}
        </Container>
      </div>
    </React.Fragment>
  );
};

const mapStateToProps = (state) => {
  const [totalSupply] = selectEthCallMultiple(state.EthereumReducer, componentEthCalls());
  const subscriptions = state.EthereumReducer.subscriptions;
  return { totalSupply, subscriptions };
};

export default connect(mapStateToProps, null)(Static);
