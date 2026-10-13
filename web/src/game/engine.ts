import { encodeAbiParameters, keccak256, type Hex } from "viem";
import { continents, territories } from "./map";
export type Phase = "deploy" | "attack" | "fortify";
export type Tile = { owner: number; units: number };
export type Battle = {
  from: number;
  to: number;
  attack: number[];
  defend: number[];
  lost: number;
  defeated: number;
  captured: boolean;
};
export type Game = {
  tiles: Tile[];
  players: number;
  mode: "solo" | "local";
  turn: number;
  round: number;
  phase: Phase;
  reserve: number;
  seed: Hex;
  battles: number;
  lastBattle: Battle | null;
  log: string[];
  over: boolean;
  winners: number[];
  fortified: boolean;
};
export function die(seed: Hex, battle: number, k: number) {
  return (
    Number(
      BigInt(
        keccak256(
          encodeAbiParameters(
            [{ type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
            [seed, BigInt(battle), BigInt(k)],
          ),
        ),
      ) % 6n,
    ) + 1
  );
}
export function compare(attack: number[], defend: number[]) {
  let lost = 0,
    defeated = 0;
  const a = [...attack].sort((a, b) => b - a),
    d = [...defend].sort((a, b) => b - a);
  for (let i = 0; i < Math.min(a.length, d.length); i++) {
    if (a[i] > d[i]) defeated++;
    else lost++;
  }
  return { lost, defeated };
}
export function reinforcements(tiles: Tile[], player: number) {
  const count = tiles.filter((t) => t.owner === player).length;
  if (!count) return 0;
  return (
    Math.max(3, Math.floor(count / 3)) +
    continents.reduce(
      (n, c) =>
        n +
        (tiles
          .slice(c.first, c.first + c.count)
          .every((t) => t.owner === player)
          ? c.bonus
          : 0),
      0,
    )
  );
}
export function startGame(
  players: number,
  mode: Game["mode"],
  seed: Hex,
): Game {
  if (players < 2 || players > 6) throw Error("Choose 2–6 factions");
  const order = territories
    .map((t) => t.id)
    .sort((a, b) => {
      const ha = keccak256(
        encodeAbiParameters(
          [{ type: "bytes32" }, { type: "uint256" }],
          [seed, BigInt(a)],
        ),
      );
      const hb = keccak256(
        encodeAbiParameters(
          [{ type: "bytes32" }, { type: "uint256" }],
          [seed, BigInt(b)],
        ),
      );
      return ha.localeCompare(hb);
    });
  const tiles: Tile[] = Array(42);
  order.forEach((id, i) => (tiles[id] = { owner: i % players, units: 3 }));
  return {
    tiles,
    players,
    mode,
    turn: 0,
    round: 1,
    phase: "deploy",
    reserve: reinforcements(tiles, 0),
    seed,
    battles: 0,
    lastBattle: null,
    log: ["Operation started. Deploy your reinforcements."],
    over: false,
    winners: [],
    fortified: false,
  };
}
function clone(g: Game): Game {
  return { ...g, tiles: g.tiles.map((t) => ({ ...t })), log: [...g.log] };
}
function record(g: Game, s: string) {
  g.log = [s, ...g.log].slice(0, 12);
}
export function deploy(g: Game, id: number, amount = 1) {
  if (
    g.over ||
    g.phase !== "deploy" ||
    g.tiles[id]?.owner !== g.turn ||
    amount < 1 ||
    amount > g.reserve ||
    !Number.isInteger(amount)
  )
    return g;
  const n = clone(g);
  n.tiles[id].units += amount;
  n.reserve -= amount;
  record(
    n,
    `${amount} Pepe${amount === 1 ? "" : "s"} deployed to ${territories[id].name}.`,
  );
  if (!n.reserve) n.phase = "attack";
  return n;
}
export function attack(g: Game, from: number, to: number) {
  const s = g.tiles[from],
    d = g.tiles[to];
  if (
    g.over ||
    g.phase !== "attack" ||
    !s ||
    !d ||
    s.owner !== g.turn ||
    d.owner === g.turn ||
    s.units < 2 ||
    !territories[from].adjacent.includes(to)
  )
    return g;
  const n = clone(g),
    a = Array.from({ length: Math.min(3, s.units - 1) }, (_, k) =>
      die(g.seed, g.battles, k),
    ).sort((a, b) => b - a),
    b = Array.from({ length: Math.min(2, d.units) }, (_, k) =>
      die(g.seed, g.battles, 3 + k),
    ).sort((a, b) => b - a),
    loss = compare(a, b);
  n.tiles[from].units -= loss.lost;
  n.tiles[to].units -= loss.defeated;
  const captured = n.tiles[to].units === 0;
  if (captured) {
    const move = Math.min(a.length, n.tiles[from].units - 1);
    n.tiles[to] = { owner: g.turn, units: move };
    n.tiles[from].units -= move;
  }
  n.battles++;
  n.lastBattle = { from, to, attack: a, defend: b, ...loss, captured };
  record(
    n,
    `${territories[from].name} → ${territories[to].name}: ${captured ? "captured." : `lost ${loss.lost}, defenders lost ${loss.defeated}.`}`,
  );
  if (n.tiles.every((t) => t.owner === g.turn)) {
    n.over = true;
    n.winners = [g.turn];
  }
  return n;
}
export function fortify(g: Game, from: number, to: number, amount: number) {
  const s = g.tiles[from],
    d = g.tiles[to];
  if (
    g.over ||
    g.phase !== "fortify" ||
    g.fortified ||
    !s ||
    !d ||
    s.owner !== g.turn ||
    d.owner !== g.turn ||
    from === to ||
    amount < 1 ||
    amount >= s.units ||
    !Number.isInteger(amount) ||
    !territories[from].adjacent.includes(to)
  )
    return g;
  const n = clone(g);
  n.tiles[from].units -= amount;
  n.tiles[to].units += amount;
  n.fortified = true;
  record(n, `${amount} Pepes moved to ${territories[to].name}.`);
  return n;
}
export function finish(g: Game) {
  const scores = Array.from(
      { length: g.players },
      (_, p) => g.tiles.filter((t) => t.owner === p).length,
    ),
    max = Math.max(...scores);
  return {
    ...g,
    over: true,
    winners: scores.flatMap((s, p) => (s === max ? [p] : [])),
  };
}
export function nextPhase(g: Game) {
  if (g.over) return g;
  if (g.phase === "deploy") return g;
  if (g.phase === "attack") return { ...g, phase: "fortify" as const };
  let p = g.turn,
    round = g.round;
  do {
    p = (p + 1) % g.players;
    if (p === 0) round++;
  } while (!g.tiles.some((t) => t.owner === p));
  if (round > 12) return finish(g);
  const n = {
    ...g,
    turn: p,
    round,
    phase: "deploy" as const,
    reserve: reinforcements(g.tiles, p),
    fortified: false,
  };
  record(n, `Faction ${p + 1} begins round ${round}.`);
  return n;
}
export function aiTurn(g: Game) {
  let n = g;
  if (g.over) return g;
  const owned = () =>
    n.tiles.map((t, id) => ({ ...t, id })).filter((t) => t.owner === n.turn);
  const front = owned()
    .filter((t) =>
      territories[t.id].adjacent.some((i) => n.tiles[i].owner !== n.turn),
    )
    .sort((a, b) => b.units - a.units);
  if (n.phase === "deploy" && front.length)
    n = deploy(n, front[0].id, n.reserve);
  for (let i = 0; i < 9 && n.phase === "attack" && !n.over; i++) {
    const choices = owned()
      .flatMap((t) =>
        territories[t.id].adjacent
          .filter(
            (j) =>
              n.tiles[j].owner !== n.turn && t.units > n.tiles[j].units + 1,
          )
          .map((j) => ({
            from: t.id,
            to: j,
            edge: t.units - n.tiles[j].units,
          })),
      )
      .sort((a, b) => b.edge - a.edge);
    if (!choices.length) break;
    n = attack(n, choices[0].from, choices[0].to);
  }
  if (n.phase === "attack") n = nextPhase(n);
  if (n.phase === "fortify") n = nextPhase(n);
  return n;
}
