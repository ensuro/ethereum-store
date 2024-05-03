import React, { useEffect, useState } from "react";
import _ from "lodash";
import { map } from "lodash";
import { Container } from "reactstrap";
import { Button } from "react-bootstrap";
import { connect, useDispatch } from "react-redux";
import { selectCurrentChain, selectEthCallMultiple } from "../../store/ethereum/selectors";
import SubsManager from "./subsManager";
import { addRemoveEthSub } from "../../utils/helpers/store_helper";

const componentEthCalls = function () {
  // USDC Address
  return [{ address: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", abi: "ERC20", method: "totalSupply", args: [] }];
};

const Static = ({ totalSupply, subscriptions, currentChain }) => {
  let dispatch = useDispatch();
  const [sub, setSub] = useState(false);

  useEffect(() => {
    return addRemoveEthSub(dispatch, "staticDashboard", componentEthCalls());
  }, [dispatch]);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <h1>Dashboard to see ETH Subscriptions on USDC Contract</h1>
          <h3>Contract Address: 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8</h3>

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
                  {subscriptions[key]?.functions.map((s, idx) => (
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
  const currentChain = selectCurrentChain(state.EthereumReducer);
  const subscriptions = state.EthereumReducer.chainState[currentChain?.id]?.subscriptions;
  return { totalSupply, subscriptions, currentChain };
};

export default connect(mapStateToProps, null)(Static);
