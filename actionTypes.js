/* ETHEREUM */
export const ETH_CALL = "ETH_CALL";
export const ETH_CALL_SUCCESS = "ETH_CALL_SUCCESS";
export const ETH_CALL_FAIL = "ETH_CALL_FAIL";

/*
 * Sample actions
 * {type: ETH_CALL, address: "0x...", method: "totalSupply", args: []}
 * {type: ETH_CALL_SUCCESS, call_key: "0x...", method: "totalSupply", args: []}
 * {type: ETH_CALL, address: usdc.address, abi: "ERC20Permit", method: "balanceOf", args: [user.address]}
 * {type: ETH_CALL, address: eToken.address, abi: "EToken", method: "balanceOf", args: [user.address]}
 * {type: ETH_CALL, address: eToken.address, abi: "EToken", method: "totalSupply", args: []}
 */

export const ETH_ADD_SUBSCRIPTION = "ETH_ADD_SUBSCRIPTION";
export const ETH_REMOVE_SUBSCRIPTION = "ETH_REMOVE_SUBSCRIPTION";

/*
 * Sample actions
 * {type: ETH_ADD_SUBSCRIPTION, key: "positions", componentEthCalls: [{address: "0x...", abi: "AavePool", method: "getUserAccountData", args: [user.address]}]}
 */

export const ETH_DISPATCH_CLOCK = "ETH_DISPATCH_CLOCK";
export const SET_TIMESTAMP_TO_REFRESH = "SET_TIMESTAMP_TO_REFRESH";

/* ETH Transactions */
export const ETH_TRANSACT = "ETH_TRANSACT"; // UI --> saga
export const ETH_TRANSACT_QUEUED = "ETH_TRANSACT_QUEUED"; // si user acepta viene aca
export const ETH_TRANSACT_REJECTED = "ETH_TRANSACT_REJECTED"; // si user rechaza viene aca

export const ETH_TRANSACT_MINED = "ETH_TRANSACT_MINED"; // cuando status == success (Tx receipt)
export const ETH_TRANSACT_REVERTED = "ETH_TRANSACT_REVERTED"; // por algun motivo fallo en la blockchain
export const ETH_TRANSACT_EXPIRED = "ETH_TRANSACT_EXPIRED"; // muchos intentos y no hay success o error

/*
 * Sample actions
 * {type: ETH_TRANSACT, address: "0x...", method: "approve", abi: "ERC20Permit" args: []}
 * {type: ETH_TRANSACT_QUEUED, id: 0, txHash: "0x..." }
 * {type: ETH_TRANSACT_REJECTED, id: 0, error: error.message }
 * {type: ETH_TRANSACT_MINED, id:  0}
 * {type: ETH_TRANSACT_REVERTED, id: 0 }
 * {type: ETH_TRANSACT_EXPIRED, id: 0 }
 * los ultimos 3 solo cambian el status
 */

/**
 * ETH Sign
 * ERC-2612: Permit Extension for EIP-20 Signed Approvals
 * https://eips.ethereum.org/EIPS/eip-2612
 */
export const ETH_EIP_712_SIGN = "ETH_EIP_712_SIGN";
export const ETH_EIP_712_SIGN_PROCESSED = "ETH_EIP_712_SIGN_PROCESSED";
export const ETH_EIP_712_SIGN_FAILED = "ETH_EIP_712_SIGN_FAILED";

/*
 * Sample actions
 * {type: ETH_EIP_712_SIGN, key: userAddress + "_" + amount,  state: "PENDING" }
 * {type: ETH_EIP_712_SIGN_PROCESSED, key: userAddress + "_" + amount, signature: "0x1234...", userAddress: "0x...", spender: pool.address, amount: amount, deadline: 1234, nonce: 1}
 * {type: ETH_EIP_712_SIGN_FAILED, key: userAddress + "_" + amount, payload: error.message  }
 */
