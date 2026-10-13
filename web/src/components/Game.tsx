import { useEffect, useRef, useState } from "react";
import { bytesToHex } from "viem";
import {
  attack,
  aiTurn,
  deploy,
  finish,
  fortify,
  nextPhase,
  startGame,
  type Game as GameState,
} from "../game/engine";
import { bridges, continents, factions, rank, territories } from "../game/map";
import { Pepe } from "./Pepe";
import { Dialog } from "./Dialog";
const preview = startGame(6, "solo", `0x${"19".repeat(32)}`);
export function Game({
  hostPaused,
  onRewards,
  onResult,
}: {
  hostPaused: boolean;
  onRewards: () => void;
  onResult: (score: number) => void;
}) {
  const [game, setGame] = useState<GameState | null>(null),
    [players, setPlayers] = useState(6),
    [mode, setMode] = useState<"solo" | "local">("solo"),
    [selected, setSelected] = useState(0),
    [target, setTarget] = useState<number | null>(null),
    [amount, setAmount] = useState(1),
    [paused, setPaused] = useState(false),
    [help, setHelp] = useState(false),
    [sound, setSound] = useState(false),
    [seconds, setSeconds] = useState(0),
    [continent, setContinent] = useState(-1),
    [squad, setSquad] = useState<number[]>([]),
    [notice, setNotice] = useState(""),
    [showResults, setShowResults] = useState(false);
  const drag = useRef(false),
    root = useRef<HTMLElement>(null),
    audio = useRef<AudioContext | null>(null);
  const board = game ?? preview,
    locked =
      paused ||
      hostPaused ||
      help ||
      board.over ||
      (board.mode === "solo" && board.turn !== 0 && !!game),
    tile = board.tiles[selected];
  const start = () => {
    const next = startGame(
      players,
      mode,
      bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    );
    setGame(next);
    setSelected(next.tiles.findIndex((t) => t.owner === 0));
    if (window.innerWidth < 540)
      setContinent(
        territories[next.tiles.findIndex((t) => t.owner === 0)].continent,
      );
    setTarget(null);
    setPaused(false);
    setSeconds(0);
    setShowResults(false);
    setSquad([]);
    setNotice("");
  };
  useEffect(() => {
    if (!game || locked) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [!!game, locked]);
  useEffect(() => {
    if (seconds >= 600 && game && !game.over)
      setGame((g) => (g ? finish(g) : g));
  }, [seconds, game]);
  useEffect(() => {
    if (game?.over) {
      setShowResults(true);
      onResult(game.tiles.filter((t) => t.owner === 0).length);
    }
  }, [game?.over]);
  useEffect(() => {
    if (
      !game ||
      game.over ||
      paused ||
      hostPaused ||
      help ||
      game.mode !== "solo" ||
      game.turn === 0
    )
      return;
    const timer = setTimeout(() => setGame((g) => (g ? aiTurn(g) : g)), 550);
    return () => clearTimeout(timer);
  }, [game, paused, hostPaused, help]);
  useEffect(() => {
    if (!game) return;
    setTarget(null);
    setAmount(1);
    setSquad([]);
    const first = game.tiles.findIndex((t) => t.owner === game.turn);
    setSelected(first);
    if (window.innerWidth < 540) setContinent(territories[first].continent);
  }, [game?.turn]);
  const select = (id: number) => {
    if (locked || !game) return;
    if (
      game &&
      game.phase !== "deploy" &&
      selected !== id &&
      board.tiles[selected].owner === board.turn &&
      territories[selected].adjacent.includes(id) &&
      ((game.phase === "attack" && board.tiles[id].owner !== board.turn) ||
        (game.phase === "fortify" && board.tiles[id].owner === board.turn))
    ) {
      setTarget(id);
      setNotice("");
      return;
    }
    setSelected(id);
    setTarget(null);
    setAmount(1);
    setNotice("");
  };
  const act = () => {
    if (!game || locked) return;
    let next = game;
    if (game.phase === "deploy") {
      if (squad.length > 1) {
        const eligible = squad.filter((i) => game.tiles[i].owner === game.turn);
        for (const i of eligible) if (next.reserve) next = deploy(next, i, 1);
      } else next = deploy(game, selected, Math.min(amount, game.reserve));
    } else if (target !== null) {
      if (game.phase === "attack") {
        next = attack(game, selected, target);
        if (next !== game && sound) {
          try {
            audio.current ??= new AudioContext();
            void audio.current.resume();
            const o = audio.current.createOscillator(),
              gain = audio.current.createGain();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(135, audio.current.currentTime);
            o.frequency.exponentialRampToValueAtTime(
              65,
              audio.current.currentTime + 0.12,
            );
            gain.gain.setValueAtTime(0.06, audio.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              audio.current.currentTime + 0.16,
            );
            o.connect(gain).connect(audio.current.destination);
            o.start();
            o.stop(audio.current.currentTime + 0.17);
          } catch {
            /* Audio is optional */
          }
        }
      } else next = fortify(game, selected, target, amount);
    }
    if (next === game)
      setNotice("Select a valid territory and check your troop count.");
    else {
      setGame(next);
      setNotice("");
      if (next.lastBattle?.captured) setTarget(null);
    }
  };
  const advance = () => {
    if (!game || locked) return;
    if (game.phase === "deploy") {
      setNotice(`Deploy all ${game.reserve} reinforcements before attacking.`);
      return;
    }
    setGame(nextPhase(game));
    setTarget(null);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        el.closest("input,select,textarea,button,dialog,a") ||
        !root.current ||
        !game
      )
        return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaused((v) => !v);
        return;
      }
      if (locked) return;
      if (/^[1-6]$/.test(e.key)) {
        setContinent(Number(e.key) - 1);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (game.lastBattle) {
          setSelected(game.lastBattle.to);
          setContinent(territories[game.lastBattle.to].continent);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        act();
      }
      if (e.key.toLowerCase() === "a" && game.phase === "deploy") advance();
      if (e.key.toLowerCase() === "f" && game.phase === "attack") advance();
      if (e.key.toLowerCase() === "d" && game.phase === "fortify") advance();
      if (e.key.toLowerCase() === "d" && game.phase === "deploy")
        document.getElementById("commit-order")?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });
  const zoom =
    continent < 0
      ? "18 10 930 554"
      : (() => {
          const ts = territories.filter((t) => t.continent === continent),
            xs = ts.map((t) => t.x),
            ys = ts.map((t) => t.y);
          return `${Math.min(...xs) - 52} ${Math.min(...ys) - 62} ${Math.max(...xs) - Math.min(...xs) + 104} ${Math.max(...ys) - Math.min(...ys) + 110}`;
        })();
  const label =
    game?.phase === "deploy"
      ? `Deploy ${squad.length > 1 ? "squad" : `${Math.min(amount, game.reserve)} Pepe${amount === 1 ? "" : "s"}`}`
      : game?.phase === "attack"
        ? "Roll attack dice"
        : "Move Pepes";
  const canAct =
    !!game &&
    !locked &&
    (game.phase === "deploy"
      ? tile.owner === game.turn
      : target !== null &&
        tile.units > 1 &&
        (game.phase !== "fortify" || (!game.fortified && amount < tile.units)));
  return (
    <section ref={root} className="war-room" aria-label="Playable war room">
      <div className="game-heading">
        <div>
          <h1>Take the territory.</h1>
          <p>A tactical Pepe conquest game.</p>
        </div>
        <div className="game-utilities">
          <button onClick={() => setHelp(true)} aria-label="How to play">
            ?
          </button>
          <button onClick={() => setSound((v) => !v)} aria-pressed={sound}>
            {sound ? "Sound on" : "Sound off"}
          </button>
          {game && <button onClick={() => setPaused(true)}>Pause</button>}
        </div>
      </div>
      <div className="operation-bar">
        <span>
          <i className="status-dot" />{" "}
          {game
            ? game.mode === "solo"
              ? "You vs swarm AI"
              : "Local pass & play"
            : "Free practice · no wallet needed"}
        </span>
        <span className="numeric">
          {game
            ? `Round ${game.round}/12 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : "42 territories / 6 continents"}
        </span>
      </div>
      {!game && (
        <div className="start-strip">
          <label>
            Opponents
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="solo">Swarm AI</option>
              <option value="local">Friends on this device</option>
            </select>
          </label>
          <label>
            Factions
            <select
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p === 6 ? " · all-out war" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={start}>
            Start operation <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
      <div className="battle-layout">
        <div className="map-panel">
          <div className="map-toolbar">
            <span>
              {continent < 0 ? "World overview" : continents[continent].name}
            </span>
            <label className="sr-only" htmlFor="map-view">
              Map view
            </label>
            <select
              id="map-view"
              aria-label="Map view"
              value={continent}
              onChange={(e) => setContinent(Number(e.target.value))}
            >
              <option value={-1}>All continents</option>
              {continents.map((c, i) => (
                <option key={c.name} value={i}>
                  {i + 1} · {c.short} +{c.bonus}
                </option>
              ))}
            </select>
          </div>
          <div
            className={`map-scene ${game ? "active" : ""}`}
            onPointerUp={() => (drag.current = false)}
            onPointerLeave={() => (drag.current = false)}
          >
            <svg
              className="world-map"
              viewBox={zoom}
              aria-label="World map with 42 selectable territories"
              onPointerUp={() => (drag.current = false)}
            >
              <defs>
                <pattern
                  id="grid"
                  width="38"
                  height="38"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 38 0 L 0 0 0 38"
                    fill="none"
                    stroke="#334348"
                    strokeWidth=".5"
                  />
                </pattern>
                <pattern
                  id="sea"
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M0 10L10 0" stroke="#17232b" strokeWidth=".5" />
                </pattern>
                <filter id="selected-glow">
                  <feGaussianBlur stdDeviation="4" />
                </filter>
              </defs>
              <rect
                x="-1000"
                y="-1000"
                width="3000"
                height="3000"
                fill="#101b22"
              />
              <rect x="18" y="10" width="930" height="554" fill="url(#grid)" />
              <path
                d="M70 75Q450 0 906 87M39 299Q490 343 924 297M106 543Q463 585 922 542M367 43Q333 285 392 535M919 54Q817 300 913 535"
                stroke="#506368"
                strokeWidth=".65"
                opacity=".4"
                fill="none"
              />
              <text
                x="355"
                y="337"
                fill="#71828a"
                fontSize="12"
                transform="rotate(-72 355 337)"
              >
                Atlantic Ocean
              </text>
              <text x="785" y="385" fill="#71828a" fontSize="12">
                Indian Ocean
              </text>
              {bridges
                .filter(([a, b]) => !(a === 0 && b === 29))
                .map(([a, b]) => (
                  <line
                    key={`${a}-${b}`}
                    x1={territories[a].x}
                    y1={territories[a].y}
                    x2={territories[b].x}
                    y2={territories[b].y}
                    stroke="#869095"
                    strokeWidth="1.3"
                    strokeDasharray="4 5"
                    opacity=".5"
                  />
                ))}
              <path
                d="M60 129Q16 20 820 72L827 100"
                stroke="#869095"
                strokeWidth="1"
                strokeDasharray="4 6"
                fill="none"
                opacity=".4"
              />
              {continents.map((c) => (
                <g key={c.name}>
                  <line
                    x1={c.x - 44}
                    x2={c.x + 44}
                    y1={c.y - 15}
                    y2={c.y - 15}
                    stroke={
                      c.name === "Asia" || c.name === "Africa"
                        ? "#e776a5"
                        : "#77cfda"
                    }
                    strokeWidth="2"
                  />
                  <text
                    className="continent-label"
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    fill="#c0d0cb"
                    fontSize="12"
                  >
                    {c.short} +{c.bonus}
                  </text>
                </g>
              ))}
              {territories.map((t) => {
                const value = board.tiles[t.id],
                  chosen = t.id === selected,
                  aim = t.id === target,
                  adjacent =
                    game && territories[selected].adjacent.includes(t.id),
                  f = factions[value.owner];
                return (
                  <g
                    key={t.id}
                    className={`territory ${chosen ? "selected" : ""} ${aim ? "targeted" : ""}`}
                    transform={`translate(${t.x} ${t.y})`}
                    role={game ? "button" : undefined}
                    tabIndex={game ? (t.id === selected ? 0 : -1) : undefined}
                    aria-label={`${t.name}, ${f.name}, ${value.units} Pepes`}
                    aria-pressed={chosen}
                    data-territory={t.id}
                    onClick={() => select(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(t.id);
                      } else if (
                        [
                          "ArrowRight",
                          "ArrowDown",
                          "ArrowLeft",
                          "ArrowUp",
                        ].includes(e.key)
                      ) {
                        e.preventDefault();
                        const next =
                          (t.id +
                            (e.key === "ArrowLeft" || e.key === "ArrowUp"
                              ? 41
                              : 1)) %
                          42;
                        setSelected(next);
                        root.current
                          ?.querySelector<SVGGElement>(
                            `[data-territory="${next}"]`,
                          )
                          ?.focus();
                      }
                    }}
                    onPointerDown={(e) => {
                      if (e.shiftKey && game && value.owner === game.turn) {
                        drag.current = true;
                        setSquad([t.id]);
                        setSelected(t.id);
                      }
                    }}
                    onPointerEnter={() => {
                      if (
                        drag.current &&
                        game &&
                        value.owner === game.turn &&
                        rank(value.units) === rank(tile.units)
                      )
                        setSquad((s) => [...new Set([...s, t.id])]);
                    }}
                  >
                    <title>
                      {t.name} · {f.name} · {rank(value.units)}
                    </title>
                    <path
                      d="M-30-17L0-34 30-17 30 17 0 34-30 17Z"
                      fill={
                        chosen ? "#355644" : aim ? "#622f40" : `${f.color}1b`
                      }
                      stroke={
                        chosen
                          ? "#c4ffa8"
                          : aim
                            ? "#ff92a3"
                            : squad.includes(t.id)
                              ? "#ffffff"
                              : adjacent
                                ? "#dad9bc"
                                : "#b0b8ad"
                      }
                      strokeWidth={chosen || aim ? 2.7 : 1}
                      opacity={game ? 1 : 0.82}
                    />
                    <path
                      d="M-28-16L0-30 27-16 0 0Z"
                      fill={f.color}
                      opacity=".1"
                    />
                    <path
                      d="M-11-10L-8-16-2-17 1-12 6-17 12-15 14-9 11-3-8-3Z"
                      fill="#89ae60"
                    />
                    <path
                      d="M-7-12H-3M6-12H10M-6-6H9"
                      stroke="#182a20"
                      strokeWidth="2"
                    />
                    <text
                      x="0"
                      y="15"
                      textAnchor="middle"
                      fill="#eef3df"
                      fontSize="16"
                      fontWeight="600"
                    >
                      {value.units}
                    </text>
                    <text x="19" y="-3" fill={f.color} fontSize="12">
                      {value.owner + 1}
                    </text>
                  </g>
                );
              })}
              <g transform="translate(55 450)" aria-hidden="true">
                <path
                  d="M0 36V-20M-16 20H16M0-20L-6-8H6Z"
                  stroke="#8b9d9a"
                  fill="none"
                />
                <text
                  x="0"
                  y="-28"
                  textAnchor="middle"
                  fill="#a5b5ae"
                  fontSize="12"
                >
                  N
                </text>
              </g>
            </svg>
            {!game && (
              <div className="map-caption">
                <span>Operation / Neon frontier</span>
                <span>Practice map preview</span>
              </div>
            )}
            {game && hostPaused && (
              <div className="paused-cover">
                <h2>Operation paused</h2>
                <p>
                  {hostPaused
                    ? "The host has paused the game."
                    : "Your territory can wait."}
                </p>
                {!hostPaused && (
                  <button className="primary" onClick={() => setPaused(false)}>
                    Resume operation
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="map-legend">
            {factions.slice(0, board.players).map((f, i) => (
              <span
                key={f.name}
                style={{ "--faction": f.color } as React.CSSProperties}
              >
                <i />
                {i + 1}{" "}
                {game
                  ? board.tiles.filter((t) => t.owner === i).length
                  : f.name.split(" ")[0]}
                {game ? " territories" : ""}
              </span>
            ))}
          </div>
        </div>
        <aside className="command-panel">
          {!game ? (
            <>
              <div className="portrait-stage">
                <Pepe id="commander" className="commander" />
                <span className="rank-mark">›››</span>
              </div>
              <h2>Meet your commando.</h2>
              <p>Deploy your Pepes and capture the world.</p>
              <div className="brief-stats">
                <span>
                  <strong>10 min</strong>Time limit
                </span>
                <span>
                  <strong>12</strong>Round limit
                </span>
                <span>
                  <strong>0</strong>Entry cost
                </span>
              </div>
              <p className="muted small">
                Practice stays on this device. Local wins do not award tokens.
              </p>
            </>
          ) : (
            <>
              <div className="turn-heading">
                <span style={{ color: factions[game.turn].color }}>
                  Faction {game.turn + 1} · {factions[game.turn].name}
                </span>
                <strong>
                  {game.mode === "solo" && game.turn !== 0
                    ? "Swarm is thinking…"
                    : "Your orders"}
                </strong>
              </div>
              <ol className="phases">
                {(["deploy", "attack", "fortify"] as const).map((p, i) => (
                  <li key={p} className={game.phase === p ? "current" : ""}>
                    <span>{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
              <div className="selection">
                <Pepe rank={rank(tile.units)} id="selected" />
                <div>
                  <h2>{territories[selected].name}</h2>
                  <p>
                    {tile.units} Pepes · {rank(tile.units)}
                  </p>
                  <span className="small">
                    Faction {tile.owner + 1}{" "}
                    {tile.owner === game.turn ? "· yours" : ""}
                  </span>
                </div>
              </div>
              <label>
                Selected territory
                <select
                  value={selected}
                  onChange={(e) => {
                    setSelected(Number(e.target.value));
                    setTarget(null);
                  }}
                >
                  {territories.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name} · P{board.tiles[t.id].owner + 1} ·{" "}
                      {board.tiles[t.id].units}
                    </option>
                  ))}
                </select>
              </label>
              {game.phase === "deploy" ? (
                <p>
                  {game.reserve} reinforcements ready. Select your territory to
                  deploy.
                </p>
              ) : (
                <label>
                  {game.phase === "attack"
                    ? "Adjacent target"
                    : "Move to an adjacent territory"}
                  <select
                    aria-label="Adjacent target"
                    value={target ?? ""}
                    onChange={(e) =>
                      setTarget(
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  >
                    <option value="">Select a territory</option>
                    {territories[selected].adjacent
                      .filter((id) =>
                        game.phase === "attack"
                          ? board.tiles[id].owner !== game.turn
                          : board.tiles[id].owner === game.turn,
                      )
                      .map((id) => (
                        <option value={id} key={id}>
                          {territories[id].name} · {board.tiles[id].units} Pepes
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {game.phase !== "attack" && (
                <label>
                  Pepes to {game.phase === "deploy" ? "deploy" : "move"}
                  <input
                    aria-label="Pepe count"
                    type="number"
                    min="1"
                    max={
                      game.phase === "deploy" ? game.reserve : tile.units - 1
                    }
                    value={amount}
                    onChange={(e) =>
                      setAmount(
                        Math.max(1, Math.floor(Number(e.target.value) || 1)),
                      )
                    }
                  />
                </label>
              )}
              {squad.length > 1 && (
                <p>
                  {squad.length} same-rank territories selected. Deploy one to
                  each.{" "}
                  <button onClick={() => setSquad([])}>Clear squad</button>
                </p>
              )}
              <button
                id="commit-order"
                className="primary"
                disabled={!canAct}
                onClick={act}
              >
                {label}
              </button>
              <button
                disabled={locked || game.phase === "deploy"}
                onClick={advance}
              >
                {game.phase === "attack" ? "Continue to fortify" : "End turn"}{" "}
                <span aria-hidden="true">→</span>
              </button>
              {notice && (
                <p role="status" className="warning">
                  {notice}
                </p>
              )}
              {game.phase === "attack" && (
                <p className="small muted">
                  Leave one Pepe behind. Defender wins ties.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
      {game && (
        <div className="combat-feed">
          <div>
            <h2>Field report</h2>
            <p aria-live="polite">{game.log[0]}</p>
            {game.lastBattle && (
              <div className="dice-row">
                <span>Attack</span>
                {game.lastBattle.attack.map((d, i) => (
                  <b key={i}>{d}</b>
                ))}
                <span>Defence</span>
                {game.lastBattle.defend.map((d, i) => (
                  <b className="enemy" key={i}>
                    {d}
                  </b>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (game.lastBattle) {
                setSelected(game.lastBattle.to);
                setContinent(territories[game.lastBattle.to].continent);
              }
            }}
            disabled={!game.lastBattle}
          >
            Locate combat <kbd>Space</kbd>
          </button>
        </div>
      )}
      <div className="control-notes">
        <span>
          <kbd>D</kbd> Deploy <kbd>A</kbd> Attack <kbd>F</kbd> Fortify
        </span>
        <span>
          <kbd>1–6</kbd> Continents <kbd>P</kbd> Pause
        </span>
        <button onClick={() => setHelp(true)}>Read field manual ↗</button>
      </div>
      <Dialog open={help} title="Field manual" onClose={() => setHelp(false)}>
        <p>
          Capture all 42 territories, or hold the most after 12 rounds or 10
          active minutes. Tied territory counts share the win.
        </p>
        <ol>
          <li>
            <strong>Deploy:</strong> select a territory you own, choose a count,
            then deploy all reinforcements.
          </li>
          <li>
            <strong>Attack:</strong> select your source and an adjacent enemy.
            Roll up to three dice against two. Higher dice win; defenders win
            ties. Captures move the attacking dice count into the territory.
          </li>
          <li>
            <strong>Fortify:</strong> move once between adjacent territories you
            own, leaving one Pepe behind, then end turn.
          </li>
        </ol>
        <p>
          Continents add +5 / +2 / +5 / +3 / +7 / +2 to your base reinforcements
          (at least three). Rank and gear show army size and do not change
          combat.
        </p>
        <p>
          Use the territory and target menus on touch screens. Arrow keys
          explore the map; Enter selects. Shift-drag across territories to
          select a same-rank squad, then deploy one to each. Hotkeys work
          outside form controls.
        </p>
        <p>
          Solo is free practice against up to five local AIs. Friends mode
          shares this device, with no network multiplayer. Scores stay in this
          session.
        </p>
        <button className="primary" onClick={() => setHelp(false)}>
          Return to the war room
        </button>
      </Dialog>
      <Dialog
        open={paused && !hostPaused}
        title="Operation paused"
        onClose={() => setPaused(false)}
      >
        <p>The match timer stops while paused.</p>
        <button className="primary" onClick={() => setPaused(false)}>
          Resume operation
        </button>
        <button
          onClick={() => {
            if (game) setGame(finish(game));
            setPaused(false);
          }}
        >
          End practice and see results
        </button>
      </Dialog>
      <Dialog
        open={showResults && !!game}
        title={
          game?.winners.includes(0)
            ? "Territory secured."
            : "Operation complete."
        }
        onClose={() => setShowResults(false)}
      >
        <p>
          {game?.winners.map((p) => factions[p].name).join(" and ")}{" "}
          {game?.winners.length === 1 ? "wins" : "tie for first"}.
        </p>
        <ol className="results">
          {Array.from({ length: board.players }, (_, p) => ({
            p,
            count: board.tiles.filter((t) => t.owner === p).length,
          }))
            .sort((a, b) => b.count - a.count)
            .map(({ p, count }) => (
              <li key={p}>
                <span>{factions[p].name}</span>
                <strong>{count} territories</strong>
              </li>
            ))}
        </ol>
        <p>
          Practice results only. No tokens were earned. Existing on-chain prize
          entitlements are shown in Rewards.
        </p>
        <button className="primary" onClick={start}>
          Play again
        </button>
        <button
          onClick={() => {
            setShowResults(false);
            onRewards();
          }}
        >
          View wallet rewards
        </button>
      </Dialog>
    </section>
  );
}
