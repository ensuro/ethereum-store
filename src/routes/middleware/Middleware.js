import React from "react";
import PropTypes from "prop-types";
import { Route } from "react-router-dom";

const Middleware = ({ component: Component, ...rest }) => (
  <Route
    {...rest}
    render={(props) => {
      return <Component {...props} />;
    }}
  />
);

Middleware.propTypes = {
  component: PropTypes.any,
  location: PropTypes.object,
  layout: PropTypes.any,
};

export default Middleware;
