import _ from "lodash";
import Big from "big.js";
import { registerABI, registerFormatter } from "@ensuro/ethereum-store";

const BNToDecimal = (number, decimals) => {
  return Big(number).div(10 ** decimals);
};
import ierc20MetadataJson from "@openzeppelin/contracts/build/contracts/IERC20Metadata.json";
registerABI("ERC20Permit", ierc20MetadataJson.abi);
registerFormatter("ERC20", "totalSupply", _.partial(BNToDecimal, _, 6));
