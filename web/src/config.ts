import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  keccak256,
  toHex,
  type Abi,
  type Address,
} from "viem";
export type ContractName =
  | "LaunchToken"
  | "Buyback"
  | "PrizeVault"
  | "MatchFactory"
  | "Cosmetics";
export type Deployment = {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: ContractName;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  };
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    pairToken: {
      address: Address;
      symbol: string;
      name: string;
      decimals: number;
    };
    uniswapV4: {
      poolManager: Address;
      universalRouter: Address;
      quoter: Address;
      stateView: Address;
      positionManager: Address;
      permit2: Address;
      extendedSwapParams?: boolean;
    };
  };
  walletAddChain?: {
    chainId: string;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
  assets: { path: string; sha256: string }[];
};
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function abiHash(abi: unknown) {
  return keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2);
}
export async function loadDeployment() {
  const res = await fetch("./imd-deployment.json", { cache: "no-cache" });
  if (!res.ok) throw Error("Deployment file is unavailable. Reload the page.");
  const d: Deployment = await res.json();
  if (
    d.version !== 1 ||
    d.chainId !== d.network?.chainId ||
    !d.poolKey ||
    !d.contracts?.length
  )
    throw Error(
      "Deployment configuration is invalid. Transactions are disabled.",
    );
  const contracts = {} as Record<ContractName, { address: Address; abi: Abi }>;
  for (const c of d.contracts) {
    if (!/^[\w/-]+\.json$/.test(c.abiPath) || c.abiPath.includes(".."))
      throw Error("Invalid ABI path");
    const r = await fetch(`./${c.abiPath}`);
    if (!r.ok) throw Error(`Cannot load ${c.name} ABI`);
    const abi: Abi = await r.json();
    if (!Array.isArray(abi) || abiHash(abi) !== c.abiHash)
      throw Error(
        `${c.name} ABI verification failed. Transactions are disabled.`,
      );
    contracts[c.name] = { address: c.address, abi };
  }
  for (const name of [
    "LaunchToken",
    "Buyback",
    "PrizeVault",
    "MatchFactory",
    "Cosmetics",
  ] as const)
    if (!contracts[name]) throw Error(`${name} is absent from the deployment`);
  const chain = defineChain({
    id: d.chainId,
    name: d.network.name,
    nativeCurrency: d.network.nativeCurrency,
    rpcUrls: { default: { http: d.network.rpcUrls } },
    blockExplorers: { default: { name: "Explorer", url: d.network.explorer } },
  });
  const client = createPublicClient({
    chain,
    transport: fallback(
      d.network.rpcUrls.map((url) =>
        http(url, { timeout: 12000, retryCount: 1 }),
      ),
    ),
  });
  return { deployment: d, contracts, chain, client };
}
export type Runtime = Awaited<ReturnType<typeof loadDeployment>>;
export function displayAmount(value: bigint | undefined, decimals = 18) {
  if (value === undefined) return "Unavailable";
  const scale = 10n ** BigInt(decimals),
    whole = value / scale,
    frac = (value % scale)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""}`;
}
export const isUnset = (value: unknown) =>
  !value || /^0x0{40}$/i.test(String(value));
