import { useRef, useState } from "react";
import { type Address, type Hex } from "viem";
import { useWallet, walletFor, readableError, type Intent } from "../wallet";
import { Dialog } from "./Dialog";
export function Action({
  intent,
  disabled = false,
  reason = "",
  onDone,
  primary = false,
}: {
  intent: Intent | (() => Promise<Intent>);
  disabled?: boolean;
  reason?: string;
  onDone?: () => void;
  primary?: boolean;
}) {
  const w = useWallet(),
    [draft, setDraft] = useState<Intent | null>(null),
    [state, setState] = useState<
      | "idle"
      | "simulating"
      | "wallet"
      | "confirming"
      | "confirmed"
      | "uncertain"
    >("idle"),
    [error, setError] = useState(""),
    [hash, setHash] = useState<Hex>();
  const inFlight = useRef(false),
    preparedAccount = useRef<Address | undefined>(undefined);
  const label = typeof intent === "function" ? "Review action" : intent.label;
  const prepare = async () => {
    if (!w.runtime || !w.account || w.busy || inFlight.current) return;
    inFlight.current = true;
    preparedAccount.current = w.account;
    setError("");
    setHash(undefined);
    setState("simulating");
    w.setBusy(true);
    try {
      const i = typeof intent === "function" ? await intent() : intent;
      await walletFor(w.runtime, w.account);
      await w.runtime.client.simulateContract({
        ...w.runtime.contracts[i.contract],
        ...(i.address ? { address: i.address } : {}),
        ...(i.abi ? { abi: i.abi } : {}),
        functionName: i.functionName,
        args: i.args ?? [],
        account: w.account,
        value: i.value ?? 0n,
      });
      setDraft(i);
      setState("idle");
    } catch (e) {
      setError(readableError(e));
      setState("idle");
      w.setBusy(false);
      inFlight.current = false;
    }
  };
  const send = async () => {
    if (!draft || !w.runtime) return;
    setDraft(null);
    setState("wallet");
    setError("");
    let submittedHash: Hex | undefined,
      resolved = false;
    try {
      if (!w.account || w.account !== preparedAccount.current)
        throw Error("The connected wallet changed. Review the action again.");
      if (draft.expiresAt && Date.now() >= draft.expiresAt)
        throw Error(
          "Quote expired during review. Refresh the quote before continuing.",
        );
      const wallet = await walletFor(w.runtime, w.account),
        i = draft;
      const { request } = await w.runtime.client.simulateContract({
        ...w.runtime.contracts[i.contract],
        ...(i.address ? { address: i.address } : {}),
        ...(i.abi ? { abi: i.abi } : {}),
        functionName: i.functionName,
        args: i.args ?? [],
        account: w.account,
        value: i.value ?? 0n,
      });
      const h = await wallet.writeContract(request);
      submittedHash = h;
      setHash(h);
      w.setTransaction({ hash: h, label: draft.label, status: "pending" });
      setState("confirming");
      const receipt = await w.runtime.client.waitForTransactionReceipt({
        hash: h,
        timeout: 120000,
      });
      resolved = true;
      w.setTransaction({
        hash: h,
        label: draft.label,
        status: receipt.status === "success" ? "confirmed" : "reverted",
      });
      if (receipt.status !== "success")
        throw Error("The transaction reverted. No action completed.");
      setState("confirmed");
      w.refresh();
      onDone?.();
    } catch (e) {
      setError(readableError(e));
      if (submittedHash && !resolved) {
        setState("uncertain");
        w.setTransaction({
          hash: submittedHash,
          label: draft.label,
          status: "uncertain",
        });
      } else setState("idle");
    } finally {
      w.setBusy(!!submittedHash && !resolved);
      inFlight.current = false;
    }
  };
  const recheck = async () => {
    if (!hash || !w.runtime) return;
    setError("");
    try {
      const r = await w.runtime.client.getTransactionReceipt({ hash });
      w.setBusy(false);
      w.setTransaction({
        hash,
        label,
        status: r.status === "success" ? "confirmed" : "reverted",
      });
      if (r.status === "success") {
        setState("confirmed");
        w.refresh();
        onDone?.();
      } else {
        setState("idle");
        setError("Transaction reverted. You may review a new action.");
      }
    } catch {
      setError(
        "Confirmation is still unknown. Check the explorer before attempting another transaction.",
      );
    }
  };
  const blocked =
    disabled ||
    !w.verified ||
    !w.account ||
    w.chainId !== w.runtime?.deployment.chainId ||
    w.busy ||
    state === "uncertain";
  return (
    <div className="action">
      <button
        className={primary ? "primary" : ""}
        disabled={blocked}
        onClick={() => void prepare()}
      >
        {state === "simulating"
          ? "Checking action…"
          : state === "wallet"
            ? "Confirm in wallet…"
            : state === "confirming"
              ? "Awaiting confirmation…"
              : label}
      </button>
      {reason && disabled && <p className="small muted">{reason}</p>}
      {state === "confirmed" && (
        <p className="success" role="status">
          Transaction confirmed. State refreshed.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {hash && w.runtime && (
        <a
          className="transaction-link"
          target="_blank"
          rel="noreferrer"
          href={`${w.runtime.deployment.network.explorer}/tx/${hash}`}
        >
          View transaction: <span className="address">{hash}</span> ↗
        </a>
      )}
      {state === "uncertain" && (
        <button onClick={() => void recheck()}>Check confirmation</button>
      )}
      <Dialog
        open={!!draft}
        title="Review transaction"
        onClose={() => {
          setDraft(null);
          w.setBusy(false);
          inFlight.current = false;
        }}
      >
        <p>{draft?.description}</p>
        <dl>
          <dt>Contract</dt>
          <dd>{draft?.contract}</dd>
          <dt>Method</dt>
          <dd>{draft?.functionName}</dd>
          <dt>Network</dt>
          <dd>{w.runtime?.deployment.network.name}</dd>
          <dt>Wallet</dt>
          <dd className="address">{w.account}</dd>
          <dt>Contract address</dt>
          <dd className="address">
            {draft?.address ??
              (draft && w.runtime?.contracts[draft.contract].address)}
          </dd>
          <dt>Arguments (raw units)</dt>
          <dd>
            <pre>
              {JSON.stringify(
                draft?.args ?? [],
                (_, v) => (typeof v === "bigint" ? v.toString() : v),
                2,
              )}
            </pre>
          </dd>
        </dl>
        <p className="small muted">
          Your wallet will show the network gas fee. Review the exact amounts
          and recipient before signing.
        </p>
        <button className="primary" onClick={() => void send()}>
          Confirm {draft?.label.toLowerCase()}
        </button>
        <button
          onClick={() => {
            setDraft(null);
            w.setBusy(false);
            inFlight.current = false;
          }}
        >
          Cancel
        </button>
      </Dialog>
    </div>
  );
}
