import { useEffect, useState } from "react";
import { WalletProvider, useWallet, readableError } from "./wallet";
import { Game } from "./components/Game";
import {
  Contracts,
  Rewards,
  Arsenal,
  AddressLink,
} from "./components/Contracts";
import { Trade } from "./components/Trade";
import { TransactionStatus } from "./components/TransactionStatus";
import { hostBridge, hostSession, subscribeHost, reportScore } from "./host";
const pages = [
  { id: "play", label: "War room" },
  { id: "rewards", label: "Matches & rewards" },
  { id: "trade", label: "Trade RISK" },
  { id: "arsenal", label: "Arsenal" },
  { id: "contracts", label: "Contracts" },
];
export function App() {
  return (
    <WalletProvider>
      <Shell />
    </WalletProvider>
  );
}
function Shell() {
  const w = useWallet(),
    [page, setPage] = useState(
      window.parent !== window || document.body.dataset.mode === "game"
        ? "play"
        : location.hash.slice(1) || "play",
    ),
    [hostPaused, setHostPaused] = useState(false),
    [background, setBackground] = useState(document.hidden),
    [hostReady, setHostReady] = useState(false),
    [hostAccount, setHostAccount] = useState(""),
    [hostError, setHostError] = useState("");
  const embedded = window.parent !== window;
  const gameOnly = embedded || document.body.dataset.mode === "game";
  useEffect(() => {
    const visibility = () => setBackground(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    const sync = () =>
      setPage(
        !gameOnly && pages.some((p) => p.id === location.hash.slice(1))
          ? location.hash.slice(1)
          : "play",
      );
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(
    () =>
      subscribeHost(() => {
        setHostReady(hostSession.ready);
        setHostPaused(hostSession.paused);
        setHostAccount("");
        setHostError("");
      }),
    [],
  );
  const readHost = async () => {
    setHostError("");
    try {
      const result = (await hostBridge.request({ type: "account" })) as {
        address?: string;
        account?: string;
        chainId?: number;
      } | null;
      setHostAccount(
        result?.address ??
          result?.account ??
          "No wallet connected. Use the host’s Connect wallet button.",
      );
    } catch (e) {
      setHostError(readableError(e));
    }
  };
  const navigate = (id: string) => {
    location.hash = id;
    setPage(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a
          href="#play"
          onClick={() => navigate("play")}
          className="brand"
          aria-label="IMD PEPE RISK home"
        >
          <svg viewBox="0 0 36 40" aria-hidden="true">
            <path d="M2 5L18 0 34 5 32 27 18 39 4 27Z" fill="#91dd78" />
            <path
              d="M8 13L11 8 16 8 19 13 22 8 28 10 29 18 25 26 12 27 7 20Z"
              fill="#1a3024"
            />
            <path
              d="M10 15H15M22 15H27M12 22H25"
              stroke="#dcebd2"
              strokeWidth="2"
            />
          </svg>
          <span>
            IMD PEPE <strong>RISK</strong>
          </span>
        </a>
        <div className="header-actions">
          <span className="unofficial">Unofficial community game</span>
          {embedded ? (
            <span className="host-state">
              {hostReady ? "Host connected" : "Awaiting host"}
            </span>
          ) : gameOnly ? (
            <a href="./index.html">Standalone site ↗</a>
          ) : w.account ? (
            <>
              <button
                onClick={() => navigate("rewards")}
                className="wallet-connected"
              >
                Wallet connected <span aria-hidden="true">↗</span>
              </button>
              <button
                className="disconnect"
                aria-label="Disconnect wallet"
                onClick={w.disconnect}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button onClick={() => void w.connect()} disabled={w.connecting}>
              {w.connecting ? "Connecting…" : "Connect wallet"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </header>
      <nav className="main-nav" aria-label="Main navigation">
        {pages
          .filter((p) => !gameOnly || p.id === "play")
          .map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => navigate(p.id)}
            >
              {p.label}
            </a>
          ))}
        <a
          className="hosted-link"
          href="https://pepe2pepe.fun/games"
          target="_blank"
          rel="noreferrer"
        >
          Pepe2Pepe games ↗
        </a>
      </nav>
      <main id="main" tabIndex={-1}>
        <TransactionStatus />
        {w.configError && (
          <div className="error banner" role="alert">
            {w.configError}{" "}
            <button onClick={() => location.reload()}>
              Reload configuration
            </button>
          </div>
        )}
        {!embedded && w.walletError && page === "play" && (
          <div className="error banner" role="alert">
            {w.walletError}
          </div>
        )}
        {!embedded &&
          w.account &&
          w.runtime &&
          w.chainId !== w.runtime.deployment.chainId && (
            <div className="warning banner">
              <span>Wallet is on a different network.</span>
              <button
                disabled={w.connecting}
                onClick={() => void w.switchChain()}
              >
                Switch to {w.runtime.deployment.network.name}
              </button>
            </div>
          )}
        <div hidden={page !== "play"}>
          <Game
            hostPaused={hostPaused || background || page !== "play"}
            onRewards={() => {
              if (embedded)
                document.querySelector(".host-panel")?.scrollIntoView();
              else if (gameOnly) location.href = "./index.html#rewards";
              else navigate("rewards");
            }}
            onResult={reportScore}
          />
        </div>
        {page === "rewards" && !gameOnly && <Rewards />}
        {page === "trade" && !gameOnly && <Trade />}
        {page === "arsenal" && !gameOnly && <Arsenal />}
        {page === "contracts" && !gameOnly && <Contracts />}
        {embedded && (
          <section className="host-panel">
            <h2>Host wallet & rewards</h2>
            <p>
              The host connects your wallet. This deployment uses PrizeVault IMD
              claims and has no compatible Game.state/act interface. Host reward
              claims are unavailable; practice never earns tokens.
            </p>
            <button disabled={!hostReady} onClick={() => void readHost()}>
              Read host account
            </button>
            <p className="address" role="status">
              {hostAccount}
            </p>
            {hostError && (
              <p className="error" role="alert">
                {hostError}
              </p>
            )}
            <button disabled>Host claim unavailable</button>
            <p className="small muted">
              On the standalone site, use Matches &amp; rewards to claim
              existing IMD prizes.
            </p>
          </section>
        )}
      </main>
      <footer>
        <div>
          <strong>IMD PEPE RISK</strong>
          <p>Unofficial community coin. RISK is not IMD.</p>
        </div>
        {w.runtime && (
          <AddressLink
            address={w.runtime.contracts.LaunchToken.address}
            label="RISK"
          />
        )}
        <div className="footer-bottom">
          <span>
            {w.runtime?.deployment.network.name ?? "Loading deployment"} · Free
            practice stays on this device
          </span>
          <a href="./pepe-game.json">Game manifest ↗</a>
          <a href="./imd-deployment.json">Deployment ↗</a>
        </div>
      </footer>
    </>
  );
}
