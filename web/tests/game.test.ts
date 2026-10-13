import { test } from "node:test";
import assert from "node:assert/strict";
import {
  keccak256,
  toHex,
  decodeAbiParameters,
  parseAbiParameters,
  type Hex,
} from "viem";
import {
  aiTurn,
  attack,
  compare,
  deploy,
  die,
  finish,
  fortify,
  nextPhase,
  reinforcements,
  startGame,
} from "../src/game/engine";
import { territories, continents } from "../src/game/map";
import { swapCall } from "../src/swap";
import handoff from "../deployment.handoff.json";
import network from "../network.handoff.json";
import type { Deployment } from "../src/config";
const seed = keccak256(toHex("risk-regression-fixture"));
test("map has 42 unique territories, six exact continent blocks, symmetric connected adjacency", () => {
  assert.equal(territories.length, 42);
  assert.equal(new Set(territories.map((t) => t.name)).size, 42);
  assert.deepEqual(
    continents.map((c) => [c.count, c.bonus]),
    [
      [9, 5],
      [4, 2],
      [7, 5],
      [6, 3],
      [12, 7],
      [4, 2],
    ],
  );
  for (const t of territories)
    for (const n of t.adjacent) {
      assert(territories[n].adjacent.includes(t.id));
      assert.notEqual(t.id, n);
    }
  const seen = new Set([0]);
  for (const n of seen) territories[n].adjacent.forEach((i) => seen.add(i));
  assert.equal(seen.size, 42);
});
test("defender wins equal dice and sorting is non-mutating", () => {
  const a = [1, 6, 4],
    d = [6, 3];
  assert.deepEqual(compare(a, d), { lost: 1, defeated: 1 });
  assert.deepEqual(a, [1, 6, 4]);
  assert.deepEqual(compare([6, 6], [6, 6]), { lost: 2, defeated: 0 });
});
test("seeded dice are deterministic, in bounds, and battle-index dependent", () => {
  const rolls = Array.from({ length: 100 }, (_, i) => die(seed, i, 0));
  assert.deepEqual(
    rolls,
    Array.from({ length: 100 }, (_, i) => die(seed, i, 0)),
  );
  assert(rolls.every((v) => v >= 1 && v <= 6));
  assert.equal(new Set(rolls).size, 6);
});
test("continent bonuses and eliminated players", () => {
  const tiles = territories.map(() => ({ owner: 1, units: 1 }));
  for (let i = 0; i < 9; i++) tiles[i].owner = 0;
  assert.equal(reinforcements(tiles, 0), 8);
  assert.equal(reinforcements(tiles, 2), 0);
  assert.equal(
    reinforcements(
      tiles.map((t) => ({ ...t, owner: 0 })),
      0,
    ),
    38,
  );
});
test("deploy enforces ownership, phase, integer count and reserve", () => {
  let g = startGame(6, "solo", seed);
  const mine = g.tiles.findIndex((t) => t.owner === 0),
    enemy = g.tiles.findIndex((t) => t.owner !== 0);
  for (const [id, n] of [
    [enemy, 1],
    [mine, 0],
    [mine, g.reserve + 1],
    [mine, 0.5],
  ])
    assert.equal(deploy(g, id, n), g);
  assert.equal(nextPhase(g), g);
  const before = g.tiles[mine].units,
    rs = g.reserve;
  g = deploy(g, mine, rs);
  assert.equal(g.phase, "attack");
  assert.equal(g.tiles[mine].units, before + rs);
  assert.equal(g.reserve, 0);
  assert.equal(deploy(g, mine, 1), g);
});
test("battle is bounded, adjacency enforced, captured territories keep one behind", () => {
  let g = startGame(2, "local", seed);
  g.phase = "attack";
  g.tiles = g.tiles.map(() => ({ owner: 1, units: 1 }));
  g.tiles[0] = { owner: 0, units: 20 };
  assert.equal(attack(g, 0, 41), g);
  let iterations = 0;
  while (g.tiles[1].owner !== 0 && iterations++ < 20) {
    const before = g.tiles.reduce((n, t) => n + t.units, 0);
    const next = attack(g, 0, 1);
    assert.notEqual(next, g);
    assert.equal(
      before - next.tiles.reduce((n, t) => n + t.units, 0),
      next.lastBattle!.lost + next.lastBattle!.defeated,
    );
    g = next;
  }
  assert.equal(g.tiles[1].owner, 0);
  assert(g.tiles[0].units >= 1);
  assert(g.tiles[1].units >= 1);
});
test("one fortification per turn, friendly adjacent targets, no zero-garrison", () => {
  let g = startGame(2, "local", seed);
  g.phase = "fortify";
  g.tiles[0] = { owner: 0, units: 8 };
  g.tiles[1] = { owner: 0, units: 2 };
  assert.equal(fortify(g, 0, 1, 8), g);
  assert.equal(fortify(g, 0, 41, 1), g);
  const n = fortify(g, 0, 1, 7);
  assert.equal(n.tiles[0].units, 1);
  assert.equal(n.tiles[1].units, 9);
  assert.equal(fortify(n, 1, 0, 1), n);
  assert.equal(nextPhase(n).fortified, false);
});
test("time-limit scoring ties on territory count and final state freezes moves", () => {
  const g = startGame(2, "local", seed),
    n = finish(g);
  assert.deepEqual(n.winners, [0, 1]);
  assert.equal(nextPhase(n), n);
  assert.equal(attack(n, 0, 1), n);
  assert.equal(deploy(n, 0, 1), n);
});
test("50 seeded full AI matches terminate within 12 rounds and preserve positive armies", () => {
  for (let i = 0; i < 50; i++) {
    let g = startGame(2 + (i % 5), "solo", keccak256(toHex(`seed-${i}`)));
    let turns = 0;
    while (!g.over && turns++ < 100) {
      g = aiTurn(g);
      assert(
        g.tiles.every(
          (t) =>
            Number.isInteger(t.units) && t.units >= 1 && t.owner < g.players,
        ),
      );
      assert(g.reserve >= 0);
    }
    assert(g.over, `seed ${i}`);
    assert(g.winners.length >= 1);
    assert(g.round <= 12);
  }
});
test("Robinhood swaps use attested pool, extended tuple, exact settlement and zero ETH for IMD", () => {
  const d = { ...handoff, ...network } as unknown as Deployment;
  const call = swapCall(d, d.network.pairToken.address, 10n, 8n, 999n);
  assert.equal(call.value, 0n);
  assert.equal(call.args[0], "0x10");
  const [actions, params] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    call.args[1][0],
  );
  assert.equal(actions, "0x060c0f");
  const [result] = decodeAbiParameters(
    parseAbiParameters(
      "((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)",
    ),
    params[0] as Hex,
  );
  const {
    poolKey: pool,
    zeroForOne: zero,
    amountIn: amount,
    amountOutMinimum: min,
    minHopPriceX36: hop,
    hookData: data,
  } = result;
  assert.equal(pool.hooks.toLowerCase(), d.poolKey.hooks);
  assert.equal(pool.currency0.toLowerCase(), d.poolKey.currency0);
  assert.equal(zero, true);
  assert.equal(amount, 10n);
  assert.equal(min, 8n);
  assert.equal(hop, 0n);
  assert.equal(data, "0x");
  const [currency, value] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    params[1] as Hex,
  );
  assert.equal(currency.toLowerCase(), d.network.pairToken.address);
  assert.equal(value, 10n);
});
