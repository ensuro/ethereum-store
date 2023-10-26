/* This file is used only for testing purposes. */
const { ethers } = require("ethers");

const roProvider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/polygon_mumbai");

const abis = {}; // Mapping (abiName => abi)
const formatters = {}; // Mapping (abiName => method => outputFormatterFunction)

const registry = {}; // Mapping (address => ethers.Contract)
const registryAbiName = {}; // Mapping (address => abiName)

export function registerABI(abiName, abi) {
  abis[abiName] = abi;
  return abis[abiName];
}

export function getABI(abiName) {
  return abis[abiName];
}

export function registerFormatter(abiName, method, formatter) {
  if (formatters[abiName] === undefined) formatters[abiName] = { [method]: formatter };
  else formatters[abiName][method] = formatter;
}

export function getFormatter(abiName, method) {
  return formatters[abiName][method];
}

export function registerContract(address, abiName) {
  const contract = new ethers.Contract(address, abis[abiName], roProvider);
  registry[address] = contract;
  registryAbiName[address] = abiName;
  return contract;
}

export function getSignerContract(address, abiName, provider) {
  return new ethers.Contract(address, abis[abiName], provider.getSigner());
}

export function getContract(address, abiName) {
  let ret = registry[address];
  if (ret === undefined) return registerContract(address, abiName);
  else return ret;
}

export function getAbiName(address) {
  return registryAbiName[address];
}

export function getEncodedCall(address, abiName, method, args) {
  let contract = getContract(address, abiName);
  return contract.interface.encodeFunctionData(method, args);
}

export async function getTxReceiptStatus(txHash, provider) {
  let receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) return receipt.status;
  else return null;
}
