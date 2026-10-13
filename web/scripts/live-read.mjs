import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { encodeFunctionData, decodeFunctionResult } from "viem";
const run = promisify(execFile),
  d = JSON.parse(
    await readFile(new URL("../deployment.handoff.json", import.meta.url)),
  ),
  n = JSON.parse(
    await readFile(new URL("../network.handoff.json", import.meta.url)),
  );
const endpoint = n.network.rpcUrls[0];
let seq = 0;
async function rpc(method, params) {
  const { stdout } = await run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "20",
    "-X",
    "POST",
    "-H",
    "content-type: application/json",
    "--data",
    JSON.stringify({ jsonrpc: "2.0", id: ++seq, method, params }),
    endpoint,
  ]);
  const r = JSON.parse(stdout);
  if (r.error) throw Error(JSON.stringify(r.error));
  return r.result;
}
const chainId = Number(await rpc("eth_chainId", []));
if (chainId !== d.chainId) throw Error("Wrong chain");
const block = await rpc("eth_blockNumber", []);
const contracts = [];
for (const c of d.contracts) {
  const code = await rpc("eth_getCode", [c.address, block]);
  if (!code || code === "0x") throw Error(`No code for ${c.name}`);
  const abi = JSON.parse(
    await readFile(new URL(`../public/abi/${c.name}.json`, import.meta.url)),
  );
  const reads = {};
  const names = {
    LaunchToken: ["name", "symbol", "decimals", "totalSupply"],
    Buyback: ["owner", "venue", "burnedSupply", "circulatingSupply"],
    PrizeVault: ["owner", "matchFactory", "bonusPool", "totalClaimable"],
    MatchFactory: [
      "owner",
      "nextMatchId",
      "outcomeSigner",
      "imd",
      "risk",
      "vault",
      "buyback",
    ],
    Cosmetics: [
      "owner",
      "seatRewardsRecipient",
      "totalRevenue",
      "pendingSeatRewards",
    ],
  };
  for (const fn of names[c.name]) {
    const result = await rpc("eth_call", [
      { to: c.address, data: encodeFunctionData({ abi, functionName: fn }) },
      block,
    ]);
    reads[fn] = decodeFunctionResult({ abi, functionName: fn, data: result });
  }
  contracts.push({
    name: c.name,
    address: c.address,
    codeBytes: (code.length - 2) / 2,
    reads,
  });
}
const report = {
  observedAt: new Date().toISOString(),
  source: endpoint,
  chainId,
  blockNumber: Number(BigInt(block)),
  contracts,
  transactionsSent: 0,
};
await writeFile(
  new URL("../../docs/frontend/live-read.json", import.meta.url),
  JSON.stringify(
    report,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    report,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
