import { getABI } from "./contractRegistry";

const sinon = require("sinon");

export const buildFakeContractResolves = (fields, prefix, returnValues = {}) => {
  const fakeContract = {};
  prefix = prefix || "ret";
  for (const field of fields) {
    fakeContract[field] = sinon.fake.resolves(returnValues[field] || prefix + field);
  }
  return fakeContract;
};

export const buildFakeContractRejects = (fields) => {
  const fakeContract = {};
  for (const field of fields) {
    fakeContract[field] = sinon.fake.rejects("Blockchain error");
  }
  return fakeContract;
};

export const mockContractFn = () => {
  const ret = function (address, abi, _) {
    let installedContract = ret._installedContracts[address];
    if (installedContract !== undefined) return installedContract;
    installedContract = ret._defaultContracts[abi];
    return installedContract;
  };

  ret._installedContracts = {}; // Installed contracts by address
  ret._defaultContracts = {}; // Installed contracts by ABI
  ret.byAddress = (address, contract) => {
    ret._installedContracts[address] = contract;
  };
  ret.default = (contractName, contract) => {
    ret._defaultContracts[getABI(contractName)] = contract;
  };
  return ret;
};

export const mockProviderFn = () => {
  const ret = function () {
    return ret._defaultProvider;
  };

  ret._defaultProvider = {
    getSigner: sinon.fake.resolves({
      signMessage: () => "0x1234567890",
      _signTypedData: () => "0x0987654321",
    }),
  }; // Default provider
  ret.default = (provider) => {
    ret._defaultProvider = provider;
  };
  return ret;
};
