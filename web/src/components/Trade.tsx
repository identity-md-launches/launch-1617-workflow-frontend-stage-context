import { useEffect, useState } from "react";
import { erc20Abi, parseUnits, type Address } from "viem";
import { useWallet, readableError, type Intent } from "../wallet";
import { displayAmount } from "../config";
import { permit2Abi, quoterAbi, routerAbi, swapCall } from "../swap";
import { Action } from "./Action";
import { WalletGate } from "./Contracts";
export function Trade() {
  const w = useWallet(),
    [direction, setDirection] = useState<"buy" | "sell">("buy"),
    [amount, setAmount] = useState(""),
    [slippage, setSlippage] = useState("0.5"),
    [quote, setQuote] = useState<{
      out: bigint;
      at: number;
      input: bigint;
    } | null>(null),
    [quoting, setQuoting] = useState(false),
    [error, setError] = useState(""),
    [ercAllowance, setErcAllowance] = useState<bigint>(),
    [permitAllowance, setPermitAllowance] = useState<bigint>(),
    [balance, setBalance] = useState<bigint>(),
    [now, setNow] = useState(Date.now());
  const runtime = w.runtime,
    d = runtime?.deployment,
    input = (
      direction === "buy"
        ? d?.network.pairToken.address
        : runtime?.contracts.LaunchToken.address
    ) as Address | undefined,
    inputSymbol = direction === "buy" ? "IMD" : "RISK",
    outputSymbol = direction === "buy" ? "RISK" : "IMD";
  const valid =
    /^\d+(\.\d{1,18})?$/.test(amount) &&
    Number(slippage) >= 0.01 &&
    Number(slippage) <= 5 &&
    /^\d+(\.\d{1,2})?$/.test(slippage);
  let raw = 0n;
  try {
    raw = valid ? parseUnits(amount, 18) : 0n;
  } catch {
    /* invalid input */
  }
  const usable =
    valid &&
    raw > 0n &&
    raw < 2n ** 128n &&
    balance !== undefined &&
    raw <= balance;
  useEffect(() => {
    setQuote(null);
    setError("");
  }, [amount, direction, slippage, w.account, w.chainId]);
  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote]);
  useEffect(() => {
    if (!runtime || !input || !w.account) return;
    let alive = true;
    const user = w.account;
    setErcAllowance(undefined);
    setPermitAllowance(undefined);
    setBalance(undefined);
    void Promise.all([
      runtime.client.readContract({
        address: input,
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, runtime.deployment.network.uniswapV4.permit2],
      }),
      runtime.client.readContract({
        address: runtime.deployment.network.uniswapV4.permit2,
        abi: permit2Abi,
        functionName: "allowance",
        args: [
          user,
          input,
          runtime.deployment.network.uniswapV4.universalRouter,
        ],
      }),
      runtime.client.readContract({
        address: input,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [user],
      }),
    ])
      .then(([a, p, b]) => {
        if (alive) {
          setErcAllowance(a);
          setPermitAllowance(
            Number(p[1]) * 1000 > Date.now() + 120000 ? p[0] : 0n,
          );
          setBalance(b);
        }
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, [runtime, input, w.account, w.revision]);
  const getQuote = async () => {
    if (!runtime || !d || !input || !usable) return;
    setQuoting(true);
    setError("");
    setQuote(null);
    try {
      const result = await runtime.client.simulateContract({
        address: d.network.uniswapV4.quoter,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: d.poolKey,
            zeroForOne:
              input.toLowerCase() === d.poolKey.currency0.toLowerCase(),
            exactAmount: raw,
            hookData: "0x",
          },
        ],
        account: w.account,
      });
      if (!result.result[0])
        throw Error("No output liquidity is available for this amount.");
      setQuote({ out: result.result[0], at: Date.now(), input: raw });
      setNow(Date.now());
    } catch (e) {
      setError(readableError(e));
    } finally {
      setQuoting(false);
    }
  };
  const fresh = !!quote && (now - quote.at < 30000 || w.busy),
    minimum = quote
      ? (quote.out * (10000n - BigInt(Math.round(Number(slippage) * 100)))) /
        10000n
      : 0n;
  const execute = async (): Promise<Intent> => {
    if (
      !runtime ||
      !d ||
      !input ||
      !quote ||
      Date.now() - quote.at >= 30000 ||
      quote.input !== raw ||
      minimum <= 0n
    )
      throw Error("Quote expired. Get a fresh quote before swapping.");
    const block = await runtime.client.getBlock(),
      call = swapCall(d, input, raw, minimum, block.timestamp + 1200n);
    return {
      contract: "LaunchToken",
      address: d.network.uniswapV4.universalRouter,
      abi: routerAbi,
      functionName: "execute",
      args: call.args,
      value: call.value,
      label: `Swap ${inputSymbol} for ${outputSymbol}`,
      expiresAt: quote.at + 30000,
      description: `Spend ${displayAmount(raw)} ${inputSymbol}; receive at least ${displayAmount(minimum)} ${outputSymbol}. Slippage: ${slippage}%. Pool fee: ${d.poolKey.fee / 10000}%. Deadline: 20 minutes.`,
    };
  };
  return (
    <section className="content-panel trade-panel">
      <h1>Trade RISK</h1>
      <p>The attested RISK / IMD Uniswap v4 pool.</p>
      <WalletGate />
      <div className="trade-form">
        <div className="segmented">
          <button
            disabled={w.busy}
            aria-pressed={direction === "buy"}
            onClick={() => setDirection("buy")}
          >
            Buy RISK
          </button>
          <button
            disabled={w.busy}
            aria-pressed={direction === "sell"}
            onClick={() => setDirection("sell")}
          >
            Sell RISK
          </button>
        </div>
        <label>
          You pay · {inputSymbol}
          <input
            disabled={w.busy}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <p className="small muted">
          Balance: {displayAmount(balance)} {inputSymbol}
        </p>
        <label>
          Slippage tolerance · %
          <input
            disabled={w.busy}
            inputMode="decimal"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
        </label>
        <p className="small muted">
          Allowed: 0.01–5%. Quotes expire in 30 seconds. USD pricing is
          unavailable.
        </p>
        <button
          className="primary"
          disabled={
            !usable ||
            quoting ||
            !w.verified ||
            !w.account ||
            w.chainId !== d?.chainId ||
            w.busy
          }
          onClick={() => void getQuote()}
        >
          {quoting ? "Getting quote…" : quote ? "Refresh quote" : "Get quote"}
        </button>
        {amount && !usable && (
          <p className="small warning">
            Enter a positive amount within your loaded balance and the slippage
            range.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {quote && (
          <div className="quote">
            <h2>
              {displayAmount(quote.out)} {outputSymbol}
            </h2>
            <p>
              Minimum received: {displayAmount(minimum)} {outputSymbol}
            </p>
            <p className="small">
              {fresh
                ? `${Math.max(0, 30 - Math.floor((now - quote.at) / 1000))} seconds until quote expires`
                : "Quote expired. Refresh to continue."}{" "}
              · Pool fee {d!.poolKey.fee / 10000}%
            </p>
          </div>
        )}
        {fresh && d && runtime && input && (ercAllowance ?? 0n) < raw ? (
          <Action
            disabled={ercAllowance === undefined}
            intent={{
              contract: "LaunchToken",
              address: input,
              abi: erc20Abi,
              functionName: "approve",
              args: [d.network.uniswapV4.permit2, raw],
              label: `1. Approve ${inputSymbol} to Permit2`,
              description: `Set an exact allowance of ${displayAmount(raw)} ${inputSymbol} for the network’s Permit2 contract. No swap is made yet.`,
            }}
          />
        ) : fresh && d && input && (permitAllowance ?? 0n) < raw ? (
          <Action
            disabled={permitAllowance === undefined}
            intent={{
              contract: "LaunchToken",
              address: d.network.uniswapV4.permit2,
              abi: permit2Abi,
              functionName: "approve",
              args: [
                input,
                d.network.uniswapV4.universalRouter,
                raw,
                Math.floor(Date.now() / 1000) + 3600,
              ],
              label: "2. Authorize router allowance",
              description: `Permit the attested universal router to spend up to ${displayAmount(raw)} ${inputSymbol} through Permit2 for one hour.`,
            }}
          />
        ) : fresh ? (
          <Action
            intent={execute}
            disabled={
              !usable ||
              ercAllowance === undefined ||
              permitAllowance === undefined ||
              minimum <= 0n
            }
          />
        ) : null}
      </div>
      <p className="small muted">
        Two explicit approvals may be needed for ERC-20 input. The swap is
        simulated before signing. Every router, quoter and Permit2 address comes
        from the deployment’s network configuration.
      </p>
    </section>
  );
}
