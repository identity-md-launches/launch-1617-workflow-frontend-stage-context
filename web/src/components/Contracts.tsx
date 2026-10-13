import { useEffect, useState } from "react";
import {
  bytesToHex,
  encodeAbiParameters,
  erc20Abi,
  isAddress,
  keccak256,
  parseUnits,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
} from "viem";
import { displayAmount, isUnset, type ContractName } from "../config";
import {
  useReads,
  useWallet,
  readableError,
  walletFor,
  type Intent,
} from "../wallet";
import { Action } from "./Action";
import { Pepe } from "./Pepe";
const ownerMethods = new Set([
  "setMatchFactory",
  "setVenue",
  "setOutcomeSigner",
  "setSeatRewardsRecipient",
  "configureItem",
  "executeBuyback",
  "transferOwnership",
]);
const descriptions: Record<string, string> = {
  createMatch:
    "Open a paid on-chain lobby. Entry funds are escrowed, and a reveal commitment is required. This does not start or synchronize a browser game.",
  join: "Join this paid lobby. Save your reveal secret before joining. Missing the reveal deadline can forfeit your entry.",
  startReveal:
    "Close the lobby and begin its ten-minute reveal window. Underfilled expired lobbies are refunded.",
  reveal:
    "Reveal your saved secret. The contract verifies the commitment before accepting it.",
  cancelUnrevealed:
    "Cancel after the reveal deadline; revealers receive shares of the escrowed entry funds.",
  settle:
    "Submit the ranking and valid EIP-712 signatures. Game moves are not verified by this contract.",
  proposeOutcome:
    "Propose the final ranking. Other players have 24 hours to dispute it. Monitor the proposal until finalization.",
  disputeOutcome:
    "Dispute an existing proposal before its deadline. This stops optimistic payout.",
  finalizeProposal:
    "Finalize the exact undisputed ranking after its 24-hour challenge window.",
  expire:
    "Refund an unsettled match after its settlement grace period, unless an undisputed payable proposal is pending.",
  withdrawRefund: "Withdraw the IMD refund owed to this connected wallet.",
  claim:
    "Claim already-awarded IMD to this connected wallet. Practice scores have no claim value.",
  fundBonus:
    "Donate IMD to the bonus pool. It cannot be withdrawn and pays only through seat-attested results.",
  buy: "Buy appearance-only cosmetics for IMD. Gear does not change combat or improve win odds.",
  flushSeatRewards:
    "Send accumulated IMD to the owner-configured seats/stakers recipient.",
  burnHeldRisk: "Permanently burn all RISK currently held by Buyback.",
  routeRiskToImd:
    "Swap your RISK through the owner-set venue and send IMD to the specified recipient. This is separate from the vetted Uniswap trade tab.",
  executeBuyback:
    "Spend held IMD through the configured venue, then burn all RISK received in the same transaction.",
  setMatchFactory:
    "Permanently link PrizeVault to the deployed MatchFactory. This setting can only be made once.",
  setVenue:
    "Set the owner-provided swap adapter. The adapter must implement ISwapVenue and have deployed code.",
  setOutcomeSigner:
    "Set the outcome signer for future matches. A signer can direct bonus-pool rewards.",
  setSeatRewardsRecipient:
    "Set the recipient of the accumulated 35% cosmetics revenue share.",
  configureItem:
    "Set a cosmetic item’s IMD price, supply limit, and availability.",
  transferOwnership:
    "Transfer contract administration to this address. Verify that you control it.",
  transfer: "Send RISK from your connected wallet to the recipient.",
  approve:
    "Set the exact RISK allowance for a spender. An allowance authorizes token transfers.",
  transferFrom:
    "Transfer RISK using an existing allowance. The contract enforces sender and allowance permissions.",
};
export function WalletGate() {
  const w = useWallet();
  return (
    <>
      {!w.account ? (
        <div className="wallet-gate">
          <p>
            Connect a browser wallet to see your balances and available actions.
          </p>
          <button onClick={() => void w.connect()} disabled={w.connecting}>
            {w.connecting ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : w.chainId !== w.runtime?.deployment.chainId ? (
        <div className="wallet-gate warning">
          <p>
            Wrong network. Switch before approving or sending a transaction.
          </p>
          <button onClick={() => void w.switchChain()} disabled={w.connecting}>
            Switch to {w.runtime?.deployment.network.name}
          </button>
        </div>
      ) : (
        <p className="small muted">
          Connected: <span className="address">{w.account}</span>
        </p>
      )}
      {w.walletError && (
        <p role="alert" className="error">
          {w.walletError}
        </p>
      )}
      {w.rpcError && (
        <div className="error">
          <p>{w.rpcError}</p>
          <button onClick={() => void w.verify()}>Retry verification</button>
        </div>
      )}
    </>
  );
}
export function AddressLink({
  address,
  label,
}: {
  address: string;
  label?: string;
}) {
  const w = useWallet(),
    [copied, setCopied] = useState(false);
  return (
    <div className="address-row">
      <a
        href={`${w.runtime?.deployment.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
      >
        {label && <span>{label} · </span>}
        <span className="address">{address}</span> ↗
      </a>
      <button
        className="copy-button"
        aria-label={`Copy ${label ?? "address"}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(address)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
export function Rewards() {
  const w = useWallet();
  const { data, error, loading } = useReads([
    { name: "Buyback", fn: "burnedSupply", key: "burned" },
    { name: "Buyback", fn: "circulatingSupply", key: "circulating" },
    { name: "PrizeVault", fn: "bonusPool", key: "bonus" },
    { name: "PrizeVault", fn: "matchFactory", key: "factory" },
    ...(w.account
      ? [
          {
            name: "PrizeVault" as const,
            fn: "claimable",
            args: [w.account],
            key: "claim",
          },
          {
            name: "PrizeVault" as const,
            fn: "remainingRewardedWins",
            args: [w.account],
            key: "slots",
          },
          {
            name: "PrizeVault" as const,
            fn: "nextRewardedWinAt",
            args: [w.account],
            key: "next",
          },
          {
            name: "MatchFactory" as const,
            fn: "refunds",
            args: [w.account],
            key: "refund",
          },
          {
            name: "LaunchToken" as const,
            fn: "balanceOf",
            args: [w.account],
            key: "balance",
          },
        ]
      : []),
  ]);
  return (
    <section className="content-panel">
      <div className="section-heading">
        <div>
          <h1>Matches & rewards</h1>
          <p>On-chain IMD entitlements, separate from free practice.</p>
        </div>
        <button onClick={w.refresh} disabled={loading}>
          Refresh state
        </button>
      </div>
      <WalletGate />
      {error && (
        <p className="error" role="alert">
          State unavailable: {error}
        </p>
      )}
      <div className="stats-grid">
        <div>
          <span>Claimable prize</span>
          <strong>
            {displayAmount(data.claim as bigint)} <small>IMD</small>
          </strong>
        </div>
        <div>
          <span>Reward slots available</span>
          <strong>
            {data.slots === undefined ? "—" : String(data.slots)}{" "}
            <small>/ 3</small>
          </strong>
        </div>
        <div>
          <span>Refund available</span>
          <strong>
            {displayAmount(data.refund as bigint)} <small>IMD</small>
          </strong>
        </div>
      </div>
      <div className="button-row">
        <Action
          primary
          disabled={!data.claim || loading}
          reason="An awarded IMD entitlement is required."
          intent={{
            contract: "PrizeVault",
            functionName: "claim",
            label: "Claim IMD prize",
            description: descriptions.claim,
          }}
        />
        <Action
          disabled={!data.refund || loading}
          reason="No refundable IMD is available."
          intent={{
            contract: "MatchFactory",
            functionName: "withdrawRefund",
            label: "Withdraw refund",
            description: descriptions.withdrawRefund,
          }}
        />
      </div>
      <p className="small muted">
        At most three rewarded placements per rolling 24 hours. Prize splits:
        60/25/15; two-player matches: 75/25.{" "}
        {data.slots === 0n && data.next !== undefined
          ? `Next slot: ${new Date(Number(data.next) * 1000).toLocaleString()}.`
          : ""}{" "}
        USD pricing is unavailable.
      </p>
      {data.factory !== undefined && isUnset(data.factory) && (
        <p className="warning">
          Prize settlement is not configured yet. The owner must link the vault
          to MatchFactory.
        </p>
      )}
      <MatchList />
      <details>
        <summary>Token and vault totals</summary>
        <div className="stats-grid">
          <div>
            <span>Circulating RISK</span>
            <strong>{displayAmount(data.circulating as bigint)}</strong>
          </div>
          <div>
            <span>Burned RISK</span>
            <strong>{displayAmount(data.burned as bigint)}</strong>
          </div>
          <div>
            <span>Bonus pool · IMD</span>
            <strong>{displayAmount(data.bonus as bigint)}</strong>
          </div>
        </div>
        <p>
          Circulating supply is total supply minus the dead-address balance.
          RISK is an unofficial community coin, not the IMD token.
        </p>
        {w.runtime && (
          <AddressLink
            address={w.runtime.contracts.LaunchToken.address}
            label="RISK"
          />
        )}
      </details>
    </section>
  );
}
export function MatchList() {
  const w = useWallet(),
    [matches, setMatches] = useState<
      {
        id: bigint;
        status: number;
        playerCount: number;
        maxPlayers: number;
        entryFee: bigint;
        pot: bigint;
        creator: Address;
        playDeadline: bigint;
        joinDeadline: bigint;
        revealDeadline: bigint;
        seed: Hex;
        outcomeSigner: Address;
      }[]
    >([]),
    [error, setError] = useState(""),
    [latest, setLatest] = useState<bigint>(),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState("");
  useEffect(() => {
    if (!w.runtime) return;
    let alive = true;
    void (async () => {
      try {
        const next = (await w.read("MatchFactory", "nextMatchId")) as bigint;
        const ids = Array.from(
          { length: Number(next > 21n ? 20n : next - 1n) },
          (_, i) => next - 1n - BigInt(i),
        );
        const all = await Promise.all(
          ids.map(async (id) => ({
            ...((await w.read("MatchFactory", "getMatch", [
              id,
            ])) as (typeof matches)[number]),
            id,
          })),
        );
        if (alive) {
          setMatches(all);
          setLatest(next);
          setError("");
        }
      } catch (e) {
        if (alive) {
          setError(readableError(e));
          setMatches([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [w.runtime, w.revision]);
  const load = async () => {
    try {
      if (!/^[1-9]\d*$/.test(selected))
        throw Error("Enter a positive match ID.");
      const id = BigInt(selected);
      const [match, proposal, players] = await Promise.all([
        w.read("MatchFactory", "getMatch", [id]),
        w.read("MatchFactory", "getProposal", [id]),
        w.read("MatchFactory", "playersOf", [id]),
      ]);
      setDetail(
        JSON.stringify(
          { match, proposal, players },
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2,
        ),
      );
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  };
  return (
    <div className="match-section">
      <h2>On-chain lobbies</h2>
      <p className="muted">
        Paid lobbies require an agreed off-chain game and settlement. There is
        no network multiplayer server or platform score signer.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : latest === 1n ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            ⌁
          </span>
          <h3>No on-chain matches yet</h3>
          <p>
            Start with free practice, or use the contract controls below to
            create an agreed paid match.
          </p>
        </div>
      ) : latest === undefined ? (
        <p role="status">Reading match list…</p>
      ) : (
        <div className="match-list">
          {matches.map((m) => (
            <button
              key={String(m.id)}
              onClick={() => {
                setSelected(String(m.id));
                setDetail(
                  JSON.stringify(
                    m,
                    (_, v) => (typeof v === "bigint" ? v.toString() : v),
                    2,
                  ),
                );
              }}
            >
              <strong>Match #{String(m.id)}</strong>
              <span>
                {
                  [
                    "Unknown",
                    "Open",
                    "Revealing",
                    "Playing",
                    "Settled",
                    "Cancelled",
                  ][m.status]
                }{" "}
                · {m.playerCount}/{m.maxPlayers} players
              </span>
              <span>{displayAmount(m.entryFee)} IMD entry</span>
            </button>
          ))}
          <p className="small muted">
            Showing the latest {matches.length} matches. Look up any match by ID
            below.
          </p>
        </div>
      )}
      <div className="inline-form">
        <label>
          Match ID
          <input
            inputMode="numeric"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          />
        </label>
        <button onClick={() => void load()}>Read match & proposal</button>
      </div>
      {detail && (
        <>
          <p className="small warning">
            Review the proposal’s proposedAt + 86,400 seconds for its dispute
            deadline. Use Dispute outcome in the controls before that deadline.
            Times below are Unix seconds; amounts are raw token units.
          </p>
          <pre className="state-output">{detail}</pre>
        </>
      )}
      <details>
        <summary>Paid match controls & commitment tools</summary>
        <Commitment />
        <ContractConsole initial="MatchFactory" />
      </details>
    </div>
  );
}
export function Commitment() {
  const w = useWallet(),
    [id, setId] = useState(""),
    [secret, setSecret] = useState(""),
    [commit, setCommit] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setSecret("");
    setCommit("");
  }, [w.account]);
  const generate = async () => {
    try {
      if (!w.account)
        throw Error("Connect the wallet that will create or join the match.");
      const matchId = id
        ? BigInt(id)
        : ((await w.read("MatchFactory", "nextMatchId")) as bigint);
      if (matchId < 1n) throw Error("Match ID must be positive.");
      const s = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
      setId(String(matchId));
      setSecret(s);
      setCommit(
        keccak256(
          encodeAbiParameters(
            [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }],
            [matchId, w.account, s],
          ),
        ),
      );
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  };
  return (
    <div className="commitment">
      <h3>Prepare your reveal commitment</h3>
      <p>
        Enter the match ID to join, or leave blank to read the next creation ID.
        Back up the secret before paying; losing it can forfeit your entry.
        Secrets are not stored by this site.
      </p>
      <label>
        Match ID
        <input
          value={id}
          inputMode="numeric"
          onChange={(e) => {
            setId(e.target.value);
            setSecret("");
            setCommit("");
          }}
        />
      </label>
      <button disabled={!w.account} onClick={() => void generate()}>
        Generate commitment
      </button>
      {error && <p className="error">{error}</p>}
      {commit && (
        <>
          <label>
            Commitment (paste into create or join)
            <textarea readOnly value={commit} />
          </label>
          <label>
            Reveal secret (keep until revealed)
            <textarea readOnly value={secret} />
          </label>
          <button
            onClick={() => {
              const a = document.createElement("a");
              const url = URL.createObjectURL(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        matchId: id,
                        player: w.account,
                        secret,
                        commitment: commit,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
              );
              a.href = url;
              a.download = `risk-match-${id}-reveal.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download reveal backup
          </button>
        </>
      )}
    </div>
  );
}
export function decodeInput(input: AbiParameter, text: string): unknown {
  const v = text.trim();
  if (input.type.endsWith("[]")) {
    const a = JSON.parse(v);
    if (!Array.isArray(a)) throw Error(`${input.name} requires a JSON array.`);
    return a.map((value) =>
      decodeInput(
        { ...input, type: input.type.slice(0, -2) },
        typeof value === "string" ? value : JSON.stringify(value),
      ),
    );
  }
  if (input.type === "address") {
    if (!isAddress(v)) throw Error(`${input.name}: enter a valid address.`);
    return v;
  }
  if (/^u?int/.test(input.type)) {
    if (!/^\d+$/.test(v))
      throw Error(
        `${input.name}: enter a nonnegative whole number in raw units.`,
      );
    const n = BigInt(v),
      bits = Number(input.type.replace(/^u?int/, "") || 256);
    if (n >= 2n ** BigInt(bits))
      throw Error(`${input.name} exceeds its integer size.`);
    return n;
  }
  if (input.type === "bool") {
    if (v !== "true" && v !== "false")
      throw Error(`${input.name}: choose true or false.`);
    return v === "true";
  }
  if (input.type.startsWith("bytes")) {
    if (!/^0x([\da-f]{2})*$/i.test(v))
      throw Error(`${input.name}: use even-length 0x hex.`);
    const size = Number(input.type.slice(5));
    if (size && v.length !== size * 2 + 2)
      throw Error(`${input.name}: expected ${size} bytes.`);
    return v;
  }
  return v;
}
export function ContractConsole({
  initial = "PrizeVault",
}: {
  initial?: ContractName;
}) {
  const w = useWallet(),
    [name, setName] = useState<ContractName>(initial),
    [method, setMethod] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [readout, setReadout] = useState(""),
    [reading, setReading] = useState(false);
  const funcs = (w.runtime?.contracts[name].abi.filter(
      (e) => e.type === "function",
    ) ?? []) as AbiFunction[],
    fn = funcs.find((f) => f.name === method),
    write = fn && !["view", "pure"].includes(fn.stateMutability),
    owner = useReads(
      name === "LaunchToken" ? [] : [{ name, fn: "owner", key: "owner" }],
    );
  const setup = useReads([
    { name: "PrizeVault", fn: "matchFactory", key: "factory" },
    { name: "Buyback", fn: "venue", key: "venue" },
    { name: "Cosmetics", fn: "seatRewardsRecipient", key: "recipient" },
  ]);
  let unavailable = "";
  if (
    ["createMatch", "join", "settle", "finalizeProposal"].includes(method) &&
    (isUnset(setup.data.factory) ||
      String(setup.data.factory).toLowerCase() !==
        w.runtime?.contracts.MatchFactory.address.toLowerCase())
  )
    unavailable =
      "The owner must link PrizeVault to the attested MatchFactory before this action is available.";
  if (
    ["routeRiskToImd", "executeBuyback"].includes(method) &&
    isUnset(setup.data.venue)
  )
    unavailable =
      "The owner must configure a swap venue before this action is available.";
  if (method === "flushSeatRewards" && isUnset(setup.data.recipient))
    unavailable = "The owner must configure a seats/stakers recipient first.";
  if (
    ownerMethods.has(method) &&
    (!owner.data.owner ||
      String(owner.data.owner).toLowerCase() !== w.account?.toLowerCase())
  )
    unavailable = "Connect the contract owner to use this setting.";
  useEffect(() => {
    setMethod("");
    setValues({});
    setReadout("");
    setError("");
  }, [name]);
  const riskInputIndex =
    fn?.inputs.findIndex((input) => input.name === "riskIn") ?? -1;
  if (
    ["createMatch", "join"].includes(method) &&
    riskInputIndex >= 0 &&
    /^\d+$/.test(values[String(riskInputIndex)] ?? "") &&
    BigInt(values[String(riskInputIndex)]) > 0n &&
    isUnset(setup.data.venue)
  )
    unavailable =
      "RISK entry routing is not configured. The owner must set a swap venue, or pay in IMD with riskIn = 0.";
  const args = () =>
    fn?.inputs.map((i, j) => decodeInput(i, values[String(j)] ?? "")) ?? [];
  const executeRead = async () => {
    setReading(true);
    setError("");
    try {
      const result = await w.read(name, method, args());
      setReadout(
        JSON.stringify(
          result,
          (_, v) => (typeof v === "bigint" ? v.toString() : v),
          2,
        ),
      );
    } catch (e) {
      setError(readableError(e));
    } finally {
      setReading(false);
    }
  };
  const intent = async (): Promise<Intent> => {
    const parsed = args();
    if (
      method === "setMatchFactory" &&
      String(parsed[0]).toLowerCase() !==
        w.runtime?.contracts.MatchFactory.address.toLowerCase()
    )
      throw Error(
        "Vault must be linked to the exact attested MatchFactory address.",
      );
    if (method === "setVenue" && w.runtime) {
      const code = await w.runtime.client.getBytecode({
        address: parsed[0] as Address,
      });
      if (!code || code === "0x")
        throw Error("The supplied venue has no deployed code.");
    }
    return {
      contract: name,
      functionName: method,
      args: parsed,
      label: method.replace(/([A-Z])/g, " $1").toLowerCase(),
      description:
        descriptions[method] ??
        `Execute ${method} on ${name}. Review all arguments carefully.`,
    };
  };
  return (
    <section className="console">
      <h2>Contract controls</h2>
      <p className="small muted">
        Implementation-derived controls for every public method. Integer amounts
        here use raw units (1 IMD or RISK = 10¹⁸). Simulations run before wallet
        confirmation. Internal-only methods remain subject to the contract’s
        caller checks.
      </p>
      <div className="form-grid">
        <label>
          Contract
          <select
            disabled={w.busy}
            value={name}
            onChange={(e) => setName(e.target.value as ContractName)}
          >
            {w.runtime?.deployment.contracts.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Action or read
          <select
            disabled={w.busy}
            aria-label="Contract method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setValues({});
              setReadout("");
              setError("");
            }}
          >
            <option value="">Choose a method</option>
            <optgroup label="Actions">
              {funcs
                .filter((f) => !["view", "pure"].includes(f.stateMutability))
                .map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Read state">
              {funcs
                .filter((f) => ["view", "pure"].includes(f.stateMutability))
                .map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>
      {fn && (
        <>
          <p>
            {descriptions[method] ??
              `Read ${method} directly from the deployed contract.`}
          </p>
          {fn.inputs.map((input, i) => (
            <label key={`${method}-${i}`}>
              {input.name || `Argument ${i + 1}`}{" "}
              <span className="muted small">({input.type})</span>
              {input.type === "bool" ? (
                <select
                  disabled={w.busy}
                  value={values[String(i)] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [i]: e.target.value })
                  }
                >
                  <option value="">Choose</option>
                  <option>true</option>
                  <option>false</option>
                </select>
              ) : (
                <input
                  disabled={w.busy}
                  value={values[String(i)] ?? ""}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode={input.type.startsWith("uint") ? "numeric" : "text"}
                  onChange={(e) =>
                    setValues({ ...values, [i]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          {ownerMethods.has(method) && (
            <p className="small warning">
              Owner only:{" "}
              <span className="address">
                {String(owner.data.owner ?? "Reading owner…")}
              </span>
            </p>
          )}
          {write ? (
            <Action
              key={`${name}-${method}-${JSON.stringify(values)}`}
              intent={intent}
              disabled={!!unavailable}
              reason={unavailable}
            />
          ) : (
            <button onClick={() => void executeRead()} disabled={reading}>
              {reading ? "Reading…" : `Read ${method}`}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {readout && <pre className="state-output">{readout}</pre>}
      {name === "MatchFactory" && <OutcomeSigner />}
    </section>
  );
}
function OutcomeSigner() {
  const w = useWallet(),
    [matchId, setMatchId] = useState(""),
    [ranking, setRanking] = useState(""),
    [signature, setSignature] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const sign = async () => {
    if (!w.runtime || !w.account) return;
    setBusy(true);
    setError("");
    try {
      const ids = ranking.split(/[\s,]+/).filter(Boolean);
      if (!ids.length || ids.some((a) => !isAddress(a)))
        throw Error("Enter ranked player addresses separated by commas.");
      const id = BigInt(matchId),
        match = (await w.read("MatchFactory", "getMatch", [id])) as {
          seed: Hex;
          status: number;
        },
        players = (await w.read("MatchFactory", "playersOf", [
          id,
        ])) as Address[];
      if (
        match.status !== 3 ||
        ids.length !== Math.min(3, players.length) ||
        new Set(ids.map((a) => a.toLowerCase())).size !== ids.length ||
        ids.some(
          (a) => !players.some((p) => p.toLowerCase() === a.toLowerCase()),
        ) ||
        !players.some((p) => p.toLowerCase() === w.account?.toLowerCase())
      )
        throw Error(
          "Use a playing match, your participating wallet, and a unique top-player ranking.",
        );
      const wallet = await walletFor(w.runtime, w.account);
      const sig = await wallet.signTypedData({
        domain: {
          name: "IMD PEPE RISK",
          version: "1",
          chainId: w.runtime.deployment.chainId,
          verifyingContract: w.runtime.contracts.MatchFactory.address,
        },
        types: {
          Outcome: [
            { name: "matchId", type: "uint256" },
            { name: "seed", type: "bytes32" },
            { name: "rankingHash", type: "bytes32" },
          ],
        },
        primaryType: "Outcome",
        message: {
          matchId: id,
          seed: match.seed,
          rankingHash: keccak256(
            encodeAbiParameters([{ type: "address[]" }], [ids as Address[]]),
          ),
        },
      });
      setSignature(sig);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details>
      <summary>Sign an agreed outcome</summary>
      <p>
        Signing authorizes redistribution of this match’s pot. Review the
        ranking with all players. The resulting signatures go into settle in
        player-join order; no signature is submitted automatically.
      </p>
      <label>
        Match ID
        <input
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label>
        Ranking: first, second, third (if applicable)
        <textarea
          value={ranking}
          onChange={(e) => setRanking(e.target.value)}
        />
      </label>
      <button
        disabled={
          busy ||
          !w.account ||
          !w.verified ||
          w.chainId !== w.runtime?.deployment.chainId
        }
        onClick={() => void sign()}
      >
        {busy ? "Confirm ranking in wallet…" : "Sign this ranking"}
      </button>
      {error && <p className="error">{error}</p>}
      {signature && (
        <label>
          Outcome signature
          <textarea readOnly value={signature} />
        </label>
      )}
    </details>
  );
}
export function Arsenal() {
  const w = useWallet(),
    [item, setItem] = useState("0"),
    [quantity, setQuantity] = useState("1"),
    [price, setPrice] = useState<bigint>(),
    [active, setActive] = useState(false),
    [owned, setOwned] = useState<bigint>(),
    [allowance, setAllowance] = useState<bigint>(),
    [available, setAvailable] = useState(true),
    [error, setError] = useState("");
  const valid =
    /^\d+$/.test(item) &&
    /^[1-9]\d*$/.test(quantity) &&
    BigInt(quantity) < 2n ** 64n;
  useEffect(() => {
    if (!w.runtime || !valid) return;
    let alive = true;
    const runtime = w.runtime;
    void (async () => {
      try {
        const [p, max, sold, a] = (await w.read("Cosmetics", "items", [
          BigInt(item),
        ])) as [bigint, bigint, bigint, boolean];
        const owned = w.account
          ? ((await w.read("Cosmetics", "owned", [
              w.account,
              BigInt(item),
            ])) as bigint)
          : undefined;
        const allowance = w.account
          ? await runtime.client.readContract({
              address: runtime.deployment.network.pairToken.address,
              abi: erc20Abi,
              functionName: "allowance",
              args: [w.account, runtime.contracts.Cosmetics.address],
            })
          : undefined;
        if (alive) {
          setPrice(p);
          setActive(a);
          setOwned(owned);
          setAllowance(allowance);
          setAvailable(max === 0n || sold + BigInt(quantity) <= max);
          setError("");
        }
      } catch (e) {
        if (alive) {
          setError(readableError(e));
          setPrice(undefined);
          setAllowance(undefined);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [item, quantity, w.runtime, w.account, w.revision, valid]);
  const cost = price !== undefined && valid ? price * BigInt(quantity) : 0n,
    ready = !!w.runtime && valid && active && available && cost > 0n && !error;
  return (
    <section className="content-panel">
      <h1>Arsenal</h1>
      <p>Appearance-only gear. Every Pepe fights by the same dice.</p>
      <WalletGate />
      <div className="rank-gallery">
        {["Recruit", "Scout", "Tank", "Commando", "General"].map((r, i) => (
          <div key={r}>
            <Pepe rank={r} id={r} />
            <h2>{r} Pepe</h2>
            <p>{[1, 3, 5, 10, 25][i]}+ armies</p>
          </div>
        ))}
      </div>
      <div className="form-grid">
        <label>
          On-chain item ID
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label>
          Quantity
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <p>
          {!active
            ? "This item is not configured for sale."
            : !available
              ? "This quantity exceeds the item’s remaining supply."
              : `Price: ${displayAmount(price)} IMD each. Total: ${displayAmount(cost)} IMD. Owned: ${owned ?? "Connect wallet"}.`}
        </p>
      )}
      {ready && w.runtime && (allowance ?? 0n) < cost ? (
        <Action
          disabled={allowance === undefined}
          intent={{
            contract: "Cosmetics",
            address: w.runtime.deployment.network.pairToken.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [w.runtime.contracts.Cosmetics.address, cost],
            label: `Approve ${displayAmount(cost)} IMD`,
            description:
              "Set an exact IMD allowance for this cosmetics purchase. This approval does not buy the item.",
          }}
        />
      ) : (
        <Action
          disabled={!ready || allowance === undefined}
          intent={{
            contract: "Cosmetics",
            functionName: "buy",
            args: valid ? [BigInt(item), BigInt(quantity)] : [],
            label: "Buy cosmetic",
            description: `Spend ${displayAmount(cost)} IMD on this appearance-only item.`,
          }}
        />
      )}
      <p className="small muted">
        30% goes to buy-and-burn, 35% to the bonus vault and 35% to
        seats/stakers. Burn occurs when the owner executes a buyback. USD
        pricing is unavailable.
      </p>
      <details>
        <summary>Cosmetics and owner controls</summary>
        <ContractConsole initial="Cosmetics" />
      </details>
    </section>
  );
}
export function Contracts() {
  const w = useWallet(),
    [human, setHuman] = useState("1");
  const state = useReads([
    { name: "PrizeVault", fn: "matchFactory", key: "factory" },
    { name: "Buyback", fn: "venue", key: "venue" },
    { name: "MatchFactory", fn: "outcomeSigner", key: "signer" },
    { name: "Cosmetics", fn: "seatRewardsRecipient", key: "recipient" },
  ]);
  return (
    <section className="content-panel">
      <h1>Deployment & controls</h1>
      <p>Read and interact with the exact attested implementation.</p>
      <WalletGate />
      {w.runtime && (
        <>
          <div className="verification">
            <strong>
              {w.verified
                ? "ABI hashes and on-chain code verified"
                : "Awaiting deployment verification"}
            </strong>
            <p>
              {w.runtime.deployment.network.name} · Chain{" "}
              {w.runtime.deployment.chainId}
            </p>
          </div>
          {w.runtime.deployment.contracts.map((c) => (
            <AddressLink key={c.name} address={c.address} label={c.name} />
          ))}
          <details>
            <summary>Attestation and setup state</summary>
            <dl>
              <dt>Source commit</dt>
              <dd className="address">{w.runtime.deployment.sourceCommit}</dd>
              <dt>Attestation hash</dt>
              <dd className="address">
                {w.runtime.deployment.attestationHash}
              </dd>
              {Object.entries(state.data).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className="address">
                    {isUnset(v) ? "Not configured" : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            {state.error && <p className="error">{state.error}</p>}
            <p>
              Owner settings remain owner-controlled. An unset venue disables
              RISK entry routing and buybacks. An unset signer disables
              seat-based bonuses. An unset vault link prevents settlement.
            </p>
          </details>
        </>
      )}
      <details>
        <summary>Token approval & amount helper</summary>
        <p>
          Paid match entries, donations and purchases pull ERC-20 tokens.
          Approve their exact amount first. Use the IMD approval helper below,
          or LaunchToken.approve for RISK.
        </p>
        <label>
          IMD / RISK amount
          <input
            inputMode="decimal"
            value={human}
            onChange={(e) => setHuman(e.target.value)}
          />
        </label>
        <p className="address">
          {(() => {
            try {
              return /^\d+(\.\d{1,18})?$/.test(human)
                ? parseUnits(human, 18).toString()
                : "Enter a positive decimal amount.";
            } catch {
              return "Invalid amount";
            }
          })()}
        </p>
        <ImdApproval />
      </details>
      <ContractConsole />
    </section>
  );
}
function ImdApproval() {
  const w = useWallet(),
    [spender, setSpender] = useState<ContractName>("MatchFactory"),
    [amount, setAmount] = useState("");
  const valid =
    /^\d+(\.\d{1,18})?$/.test(amount) && parseUnits(amount, 18) > 0n;
  return (
    <>
      <label>
        IMD spender
        <select
          value={spender}
          onChange={(e) => setSpender(e.target.value as ContractName)}
        >
          {["MatchFactory", "PrizeVault", "Cosmetics", "Buyback"].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label>
        Exact IMD allowance
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
      </label>
      {w.runtime && (
        <Action
          disabled={!valid}
          intent={{
            contract: spender,
            address: w.runtime.deployment.network.pairToken.address,
            abi: erc20Abi,
            functionName: "approve",
            args: [
              w.runtime.contracts[spender].address,
              valid ? parseUnits(amount, 18) : 0n,
            ],
            label: "Approve exact IMD amount",
            description: `Allow ${spender} to spend up to ${amount} IMD. This does not execute a purchase or entry.`,
          }}
        />
      )}
    </>
  );
}
