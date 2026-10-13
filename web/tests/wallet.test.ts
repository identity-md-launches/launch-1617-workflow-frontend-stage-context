import { test } from "node:test";
import assert from "node:assert/strict";
import { switchNetwork, readableError, type Provider } from "../src/wallet";
import type { Runtime } from "../src/config";
import handoff from "../deployment.handoff.json";
import network from "../network.handoff.json";
const runtime = {
  deployment: { ...handoff, ...network },
} as unknown as Runtime;
test("unknown chain offers exact add-chain object then retries switch", async () => {
  const calls: unknown[] = [];
  let first = true;
  const provider = {
    request: async (request: unknown) => {
      calls.push(request);
      if (first) {
        first = false;
        throw { code: 4902 };
      }
    },
  } as unknown as Provider;
  await switchNetwork(provider, runtime);
  assert.deepEqual(calls, [
    { method: "wallet_switchEthereumChain", params: [{ chainId: "0x1237" }] },
    { method: "wallet_addEthereumChain", params: [network.walletAddChain] },
    { method: "wallet_switchEthereumChain", params: [{ chainId: "0x1237" }] },
  ]);
});
test("wallet rejection does not trigger add-chain or retries", async () => {
  let count = 0;
  const p = {
    request: async () => {
      count++;
      throw { code: 4001, message: "Rejected" };
    },
  } as unknown as Provider;
  await assert.rejects(switchNetwork(p, runtime));
  assert.equal(count, 1);
  assert.match(readableError({ code: 4001 }), /declined/);
});
test("known contract errors explain recovery", () => {
  assert.match(
    readableError(Error("MatchIdMismatch")),
    /generate a new commitment/,
  );
  assert.match(readableError(Error("VenueNotConfigured")), /owner/);
  assert.match(readableError(Error("NothingToClaim")), /No IMD/);
});
