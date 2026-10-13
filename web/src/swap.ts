import { encodeAbiParameters, parseAbi, type Address, type Hex } from "viem";
import type { Deployment } from "./config";
export const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut, uint256 gasEstimate)",
]);
export const permit2Abi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
const poolComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;
export function swapCall(
  d: Deployment,
  input: Address,
  amount: bigint,
  minimum: bigint,
  deadline: bigint,
) {
  const zeroForOne = input.toLowerCase() === d.poolKey.currency0.toLowerCase();
  if (!zeroForOne && input.toLowerCase() !== d.poolKey.currency1.toLowerCase())
    throw Error("Input token is not in the attested pool.");
  const output = zeroForOne ? d.poolKey.currency1 : d.poolKey.currency0;
  const components = [
    { name: "poolKey", type: "tuple", components: poolComponents },
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    ...(d.network.uniswapV4.extendedSwapParams
      ? [{ name: "minHopPriceX36", type: "uint256" }]
      : []),
    { name: "hookData", type: "bytes" },
  ];
  const swap = encodeAbiParameters(
    [{ type: "tuple", components }],
    [
      {
        poolKey: d.poolKey,
        zeroForOne,
        amountIn: amount,
        amountOutMinimum: minimum,
        ...(d.network.uniswapV4.extendedSwapParams
          ? { minHopPriceX36: 0n }
          : {}),
        hookData: "0x",
      },
    ],
  );
  const settle = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [input, amount],
  );
  const take = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [output, minimum],
  );
  const inputs = [
    encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes[]" }],
      ["0x060c0f", [swap, settle, take]],
    ),
  ];
  return {
    args: ["0x10" as Hex, inputs, deadline] as const,
    value: /^0x0{40}$/i.test(input) ? amount : 0n,
  };
}
