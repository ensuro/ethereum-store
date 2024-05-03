import React, { useEffect, useState } from "react";
import { Container } from "reactstrap";
import { Form, InputGroup, Button } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { connect } from "react-redux";
import { selectCurrentChain, selectEthCall } from "../../store/ethereum/selectors";

const DynamicDashboard = ({ state, subscriptions }) => {
  let dispatch = useDispatch();
  const [contractAddress, setContractAddress] = useState("");
  const [method, setMethod] = useState("");
  const [result, setResult] = useState("");
  const [clicked, setClicked] = useState(false);

  const dispatchCall = () => {
    if (contractAddress && method)
      dispatch({ type: "ETH_CALL", address: contractAddress, abi: "ERC20", method: method, args: [] });
    setClicked(true);
  };

  useEffect(() => {
    if (contractAddress && method && clicked) {
      const res = selectEthCall(state, contractAddress, "ERC20", method);
      if (res) {
        setResult(res);
        setClicked(false);
      }
    }
  }, [clicked, contractAddress, method, state]);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <h1>ERC 20 Methods - Sepolia</h1>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Contract Address</Form.Label>
              <InputGroup>
                <Form.Control
                  placeholder="0x00"
                  id="contractAddress"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value || "")}
                />
              </InputGroup>
            </Form.Group>
            <br />
            <Form.Group className="mb-3">
              <Form.Label>Contract method</Form.Label>
              <InputGroup>
                <Form.Select onChange={(e) => setMethod(e.target.value || "")} aria-label="Select the Contract method">
                  <option value="">Select the Contract method</option>
                  <option value="totalSupply">Total Supply</option>
                  <option value="name">Name</option>
                </Form.Select>
              </InputGroup>
            </Form.Group>
          </Form>
          <br />
          <Button onClick={dispatchCall} disabled={!contractAddress || !method}>
            Dispatch call
          </Button>

          {contractAddress && method && result && (
            <>
              <hr />
              <h1>RESULT</h1>
              <h3>{result.toString()}</h3>
            </>
          )}
          <hr />
        </Container>
      </div>
    </React.Fragment>
  );
};

const mapStateToProps = (state) => {
  const currentChain = selectCurrentChain(state.EthereumReducer);
  const subscriptions = state.EthereumReducer.chainState[currentChain?.id]?.subscriptions;
  return { state: state.EthereumReducer, subscriptions };
};

export default connect(mapStateToProps, null)(DynamicDashboard);
