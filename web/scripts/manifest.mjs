import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { keccak256, toHex } from "viem";
const root = resolve(import.meta.dirname, "../.."),
  dist = resolve(root, "dist");
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const d = await read(resolve(root, "web/deployment.handoff.json")),
  n = await read(resolve(root, "web/network.handoff.json"));
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const contracts = [];
for (const c of d.contracts) {
  const abiPath = `abi/${c.name}.json`,
    abi = await read(resolve(dist, abiPath));
  if (
    !Array.isArray(abi) ||
    keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2) !== c.abiHash
  )
    throw Error(`ABI hash mismatch: ${c.name}`);
  contracts.push({
    name: c.name,
    address: c.address,
    abiHash: c.abiHash,
    abiPath,
  });
}
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.isFile() && p !== resolve(dist, "imd-deployment.json"))
      files.push(p);
    else if (e.isSymbolicLink())
      throw Error("Symlinks are not allowed in export");
  }
}
await walk(dist);
files.sort();
if (files.length > 128) throw Error("Too many assets");
let total = 0;
const assets = [];
for (const file of files) {
  const size = (await stat(file)).size;
  total += size;
  if (size > 8388608) throw Error("Asset too large");
  assets.push({
    path: relative(dist, file).replaceAll("\\", "/"),
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  });
}
if (total > 24 * 1024 * 1024)
  throw Error("Export exceeds conservative response budget");
const manifest = {
  version: 1,
  launchId: d.launchId,
  chainId: d.chainId,
  sourceCommit: d.sourceCommit,
  attestationHash: d.attestationHash,
  contracts,
  assets,
  ...(d.poolKey ? { poolKey: d.poolKey } : {}),
  network: n.network,
  ...(n.walletAddChain ? { walletAddChain: n.walletAddChain } : {}),
};
if (process.argv.includes("--check")) {
  const actual = await read(resolve(dist, "imd-deployment.json"));
  if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(manifest)))
    throw Error("Export manifest is stale or differs from handoff");
  console.log(
    `PASS: ${contracts.length} ABI bindings, exact handoff/network/poolKey, ${assets.length} SHA-256 assets, ${total} bytes`,
  );
} else {
  await writeFile(
    resolve(dist, "imd-deployment.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    `Manifest written: ${assets.length} assets, ${total} bytes; all ABI hashes verified`,
  );
}
