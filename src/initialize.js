import _ from "lodash";
import Big from "big.js";
import { registerABI, registerFormatter } from "./helpers/contractRegistry";

const BNToDecimal = (number, decimals) => {
  return Big(number).div(10 ** decimals);
};

registerABI("ERC20", require("./abis/IERC20Metadata.json").abi);

registerFormatter("ERC20", "totalSupply", _.partial(BNToDecimal, _, 6));
