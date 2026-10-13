import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createWalletClient,
  custom,
  erc20Abi,
  isAddress,
  type Address,
  type EIP1193Provider,
  type Hex,
  type Abi,
} from "viem";
import { loadDeployment, type Runtime, type ContractName } from "./config";
export type Provider = EIP1193Provider & {
  on?: (name: string, fn: (data: unknown) => void) => void;
  removeListener?: (name: string, fn: (data: unknown) => void) => void;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export function readableError(error: unknown) {
  const e = error as { shortMessage?: string; message?: string; code?: number };
  const text = e.shortMessage ?? e.message ?? String(error);
  if (e.code === 4001 || /reject|denied/i.test(text))
    return "Request declined. Nothing was submitted; you can try again.";
  const names: Record<string, string> = {
    VenueNotConfigured: "The owner has not configured a swap venue.",
    MatchFactoryNotConfigured:
      "The owner must link PrizeVault to MatchFactory before settlement.",
    NothingToClaim: "No IMD prize is available to claim.",
    NothingToWithdraw: "No refund is available.",
    ItemUnavailable: "This cosmetic is not for sale.",
    InsufficientBalance: "Your token balance is too low.",
    InsufficientAllowance: "Approve the exact token amount before continuing.",
    TooEarly: "The contract deadline has not passed yet.",
    TooLate: "This contract deadline has passed.",
    WrongStatus: "The match has moved to another phase. Refresh its state.",
    MatchIdMismatch:
      "Another match took that ID. Refresh, generate a new commitment, and retry.",
    NotOwner: "This control is reserved for the contract owner.",
    ProposalPending:
      "An undisputed proposal is pending. Finalize it after its deadline.",
    BadReveal: "The secret does not match your commitment.",
    NotPlayer: "This wallet is not a participant in that match.",
  };
  for (const [name, message] of Object.entries(names))
    if (text.includes(name)) return message;
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}
export async function switchNetwork(provider: Provider, runtime: Runtime) {
  const hex = `0x${runtime.deployment.chainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
      data?: { originalError?: { code?: number } };
    };
    if (
      e.code !== 4902 &&
      e.data?.originalError?.code !== 4902 &&
      !/unknown chain|unrecognized chain|not added/i.test(e.message ?? "")
    )
      throw error;
    if (!runtime.deployment.walletAddChain)
      throw Error(
        "This chain is missing from your wallet and no add-chain configuration is supplied.",
      );
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [runtime.deployment.walletAddChain],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  }
}
export type Intent = {
  contract: ContractName;
  functionName: string;
  args?: readonly unknown[];
  label: string;
  description: string;
  address?: Address;
  abi?: Abi;
  value?: bigint;
  expiresAt?: number;
};
export type PendingTransaction = {
  hash: Hex;
  label: string;
  status: "pending" | "uncertain" | "confirmed" | "reverted";
};
type WalletContextType = {
  runtime: Runtime | null;
  configError: string;
  rpcError: string;
  verified: boolean;
  account: Address | undefined;
  chainId: number | undefined;
  connecting: boolean;
  walletError: string;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  disconnect: () => void;
  refresh: () => void;
  revision: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
  transaction: PendingTransaction | null;
  setTransaction: (value: PendingTransaction | null) => void;
  read: (
    name: ContractName,
    fn: string,
    args?: readonly unknown[],
  ) => Promise<unknown>;
  verify: () => Promise<void>;
};
const Context = createContext<WalletContextType>(null!);
export function WalletProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null),
    [configError, setConfigError] = useState(""),
    [rpcError, setRpcError] = useState(""),
    [verified, setVerified] = useState(false),
    [account, setAccount] = useState<Address>(),
    [chainId, setChainId] = useState<number>(),
    [connecting, setConnecting] = useState(false),
    [walletError, setWalletError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [transaction, setTransaction] = useState<PendingTransaction | null>(null);
  const verifyRunning = useRef(false);
  useEffect(() => {
    let alive = true;
    loadDeployment()
      .then((r) => {
        if (alive) setRuntime(r);
      })
      .catch((e) => {
        if (alive) setConfigError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  const verify = async () => {
    if (!runtime || verifyRunning.current) return;
    verifyRunning.current = true;
    try {
      if ((await runtime.client.getChainId()) !== runtime.deployment.chainId)
        throw Error(
          "The RPC returned the wrong chain. Transactions are disabled.",
        );
      const codes = await Promise.all(
        runtime.deployment.contracts.map((c) =>
          runtime.client.getBytecode({ address: c.address }),
        ),
      );
      if (codes.some((c) => !c || c === "0x"))
        throw Error(
          "One or more deployed contracts have no code. Transactions are disabled.",
        );
      setVerified(true);
      setRpcError("");
    } catch (e) {
      setVerified(false);
      setRpcError(readableError(e));
    } finally {
      verifyRunning.current = false;
    }
  };
  useEffect(() => {
    void verify();
  }, [runtime]);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const accounts = (data: unknown) => {
        const a = data as Address[];
        setAccount(a?.[0]);
        setRevision((r) => r + 1);
      },
      chain = (data: unknown) => {
        setChainId(Number(data));
        setRevision((r) => r + 1);
      };
    provider.on?.("accountsChanged", accounts);
    provider.on?.("chainChanged", chain);
    const disconnected = () => {
      setAccount(undefined);
      setChainId(undefined);
    };
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", accounts);
      provider.removeListener?.("chainChanged", chain);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, []);
  useEffect(() => {
    if (!account) return;
    const timer = setInterval(() => {
      if (!document.hidden && !busy) setRevision((r) => r + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [account, busy]);
  const connect = async () => {
    setConnecting(true);
    setWalletError("");
    try {
      if (!window.ethereum)
        throw Error(
          "No browser wallet found. Open this site in an Ethereum wallet browser or install a browser wallet, then reconnect.",
        );
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts[0] || !isAddress(accounts[0]))
        throw Error("The wallet did not return an account.");
      setAccount(accounts[0]);
      setChainId(
        Number(await window.ethereum.request({ method: "eth_chainId" })),
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setWalletError(readableError(e));
    } finally {
      setConnecting(false);
    }
  };
  const switchChain = async () => {
    if (!runtime || !window.ethereum) return;
    setConnecting(true);
    setWalletError("");
    try {
      await switchNetwork(window.ethereum, runtime);
      setChainId(
        Number(await window.ethereum.request({ method: "eth_chainId" })),
      );
    } catch (e) {
      setWalletError(readableError(e));
    } finally {
      setConnecting(false);
    }
  };
  const read = async (
    name: ContractName,
    fn: string,
    args: readonly unknown[] = [],
  ) => {
    if (!runtime) throw Error("Deployment is still loading");
    return runtime.client.readContract({
      ...runtime.contracts[name],
      functionName: fn,
      args,
    });
  };
  return (
    <Context.Provider
      value={{
        runtime,
        configError,
        rpcError,
        verified,
        account,
        chainId,
        connecting,
        walletError,
        connect,
        switchChain,
        disconnect: () => {
          setAccount(undefined);
          setChainId(undefined);
        },
        refresh: () => setRevision((r) => r + 1),
        revision,
        busy,
        setBusy,
        transaction,
        setTransaction,
        read,
        verify,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useWallet = () => useContext(Context);
export function useReads(
  requests: {
    name: ContractName;
    fn: string;
    args?: readonly unknown[];
    key: string;
  }[],
) {
  const w = useWallet(),
    [data, setData] = useState<Record<string, unknown>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    key = JSON.stringify(requests, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  useEffect(() => {
    if (!w.runtime) return;
    let alive = true;
    setLoading(true);
    Promise.all(
      requests.map(
        async (r) => [r.key, await w.read(r.name, r.fn, r.args)] as const,
      ),
    )
      .then((values) => {
        if (alive) {
          setData(Object.fromEntries(values));
          setError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setData({});
          setError(readableError(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [w.runtime, w.revision, key]);
  return { data, error, loading };
}
export async function walletFor(runtime: Runtime, account: Address) {
  if (!window.ethereum) throw Error("Open a browser wallet to continue.");
  const chain = Number(
    await window.ethereum.request({ method: "eth_chainId" }),
  );
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (chain !== runtime.deployment.chainId)
    throw Error(
      `Switch to ${runtime.deployment.network.name} before continuing.`,
    );
  if (accounts[0]?.toLowerCase() !== account.toLowerCase())
    throw Error("The active wallet changed. Review the action again.");
  return createWalletClient({
    account,
    chain: runtime.chain,
    transport: custom(window.ethereum),
  });
}
export { erc20Abi };
export type TransactionHash = Hex;
