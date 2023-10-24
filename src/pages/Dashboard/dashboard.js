import React, { useEffect, useState } from "react";
import { Container } from "reactstrap";
import { Form, InputGroup, Button } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { connect } from "react-redux";
import { selectEthCall } from "../../package-index";

const Dashboard = ({ state }) => {
  let dispatch = useDispatch();
  const [contractAddress, setContractAddress] = useState("");
  const [method, setMethod] = useState("");
  const [result, setResult] = useState("");
  const [clicked, setClicked] = useState(false);

  const dispatchCall = () => {
    if (contractAddress && method)
      dispatch({
        type: "ETH_CALL",
        address: contractAddress,
        abi: "ERC20",
        method: method,
        args: [],
      });
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
          <h1>ERC 20 Methods - Mumbai</h1>
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
                <Form.Control
                  placeholder="Enter the contract method"
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value || "")}
                />
              </InputGroup>
            </Form.Group>
          </Form>
          <br />
          <Button onClick={dispatchCall} disabled={!contractAddress || !method}>
            Dispatch call
          </Button>

          <br />
          <br />
          {contractAddress && method && result && (
            <>
              <h1>RESULT</h1>
              <h3>{result.toString()}</h3>
            </>
          )}
        </Container>
      </div>
    </React.Fragment>
  );
};

const mapStateToProps = (state) => {
  return { state: state.EthereumReducer };
};

export default connect(mapStateToProps, null)(Dashboard);
