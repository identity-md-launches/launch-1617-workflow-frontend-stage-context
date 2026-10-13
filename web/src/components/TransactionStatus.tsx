import { useState } from "react";
import { useWallet } from "../wallet";
export function TransactionStatus() {
  const w = useWallet(),
    [checking, setChecking] = useState(false),
    [error, setError] = useState("");
  const tx = w.transaction;
  if (!tx || !w.runtime) return null;
  const pending = tx.status === "pending" || tx.status === "uncertain";
  const check = async () => {
    if (!w.runtime) return;
    setChecking(true);
    setError("");
    try {
      const r = await w.runtime.client.getTransactionReceipt({ hash: tx.hash });
      w.setTransaction({
        ...tx,
        status: r.status === "success" ? "confirmed" : "reverted",
      });
      w.setBusy(false);
      w.refresh();
    } catch {
      setError(
        "Confirmation is not available yet. Check the explorer; do not repeat the transaction.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="banner transaction-status" role="status">
      <span>
        {tx.label}:{" "}
        {tx.status === "pending"
          ? "awaiting confirmation"
          : tx.status === "uncertain"
            ? "confirmation unknown"
            : tx.status}
        .
      </span>
      <a
        target="_blank"
        rel="noreferrer"
        href={`${w.runtime.deployment.network.explorer}/tx/${tx.hash}`}
      >
        View wallet transaction ↗
      </a>
      {pending ? (
        <button disabled={checking} onClick={() => void check()}>
          {checking ? "Checking…" : "Check transaction status"}
        </button>
      ) : (
        <button onClick={() => w.setTransaction(null)}>Dismiss status</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
