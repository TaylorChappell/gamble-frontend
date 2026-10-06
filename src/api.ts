import bs58 from "bs58";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import type {
  SolanaSignMessageFeature,
  SolanaSignAndSendTransactionFeature,
} from "@solana/wallet-standard-features";
let selectedWallet: Wallet | undefined,
  selectedAccount: WalletAccount | undefined,
  offWallet: (() => void) | undefined;
export function availableWallets() {
  return getWallets()
    .get()
    .filter(
      (w) =>
        "standard:connect" in w.features && "solana:signMessage" in w.features,
    );
}
export const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export type Auth = {
  wallet: string;
  token: string;
  expiresAt: number;
  operator: boolean;
};
let auth: Auth | null = null;
export function setAuth(value: Auth | null) {
  auth = value;
}
export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  if (!BASE) throw Error("Backend URL has not been configured");
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(auth && auth.expiresAt > Date.now()
        ? { authorization: `Bearer ${auth.token}` }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
    credentials: "omit",
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      setAuth(null);
      window.dispatchEvent(new Event("house:auth-expired"));
    }
    throw Error(String(data.error || "Request failed").replaceAll("_", " "));
  }
  return data;
}
export function provider() {
  const w = window as any;
  return w.phantom?.solana || w.solflare || w.solana;
}
export async function connectWallet(walletName?: string): Promise<Auth> {
  const wallets = availableWallets();
  const w = walletName
    ? wallets.find((w) => w.name === walletName)
    : wallets.find((w) => w.name === "Phantom") || wallets[0];
  if (!w)
    throw Error(
      "Open HOUSE in a Solana wallet browser, or install a compatible wallet extension.",
    );
  const connected = await (w.features["standard:connect"] as any).connect();
  const account: WalletAccount | undefined = connected.accounts.find(
    (a: WalletAccount) =>
      a.chains.includes("solana:mainnet") &&
      a.features.includes("solana:signMessage"),
  );
  if (!account) throw Error("Select a Solana mainnet account in your wallet.");
  const challenge = await api("/v1/auth/challenge", {
    wallet: account.address,
  });
  const feature = w.features[
    "solana:signMessage"
  ] as SolanaSignMessageFeature["solana:signMessage"];
  const [signed] = await feature.signMessage({
    account,
    message: new TextEncoder().encode(challenge.message),
  });
  if (new TextDecoder().decode(signed.signedMessage) !== challenge.message)
    throw Error("Wallet modified the sign-in message.");
  const result = await api("/v1/auth/verify", {
    id: challenge.id,
    signature: bs58.encode(signed.signature),
  });
  selectedWallet = w;
  selectedAccount = account;
  offWallet?.();
  const events = w.features["standard:events"] as any;
  offWallet = events?.on("change", (change: any) => {
    if (
      change.accounts &&
      !change.accounts.some((a: any) => a.address === account.address)
    ) {
      setAuth(null);
      selectedAccount = undefined;
      window.dispatchEvent(new Event("house:auth-expired"));
    }
  });
  setAuth(result);
  return result;
}
export async function disconnectWallet() {
  setAuth(null);
  offWallet?.();
  offWallet = undefined;
  const feature = selectedWallet?.features["standard:disconnect"] as any;
  await feature?.disconnect();
  selectedWallet = undefined;
  selectedAccount = undefined;
}
export async function signLaunch(transactionBase64: string) {
  if (
    !selectedWallet ||
    !selectedAccount ||
    !auth ||
    selectedAccount.address !== auth.wallet ||
    auth.expiresAt <= Date.now()
  )
    throw Error("Reconnect your wallet before signing.");
  const feature = selectedWallet.features["solana:signAndSendTransaction"] as
    | SolanaSignAndSendTransactionFeature["solana:signAndSendTransaction"]
    | undefined;
  if (!feature)
    throw Error(
      "Your wallet does not support signing and sending transactions.",
    );
  const transaction = Uint8Array.from(atob(transactionBase64), (c) =>
    c.charCodeAt(0),
  );
  const [result] = await feature.signAndSendTransaction({
    account: selectedAccount,
    chain: "solana:mainnet",
    transaction,
    options: { commitment: "confirmed", skipPreflight: false },
  });
  return bs58.encode(result.signature);
}
export const short = (s: string) =>
  s.length > 15 ? s.slice(0, 5) + "…" + s.slice(-4) : s;
export function amount(value: string | undefined, decimals = 9) {
  let n = BigInt(value || "0");
  const negative = n < 0n;
  if (negative) n = -n;
  const whole = n / 10n ** BigInt(decimals),
    fraction = (n % 10n ** BigInt(decimals))
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
  return `${negative ? "−" : ""}${whole.toLocaleString()}${fraction ? "." + fraction : ""}`;
}
export function atomic(input: string, decimals = 9) {
  if (!/^\d+(\.\d+)?$/.test(input))
    throw Error("Enter a positive decimal amount");
  const [a, b = ""] = input.split(".");
  if (b.length > decimals) throw Error(`Use at most ${decimals} decimals`);
  return (
    BigInt(a) * 10n ** BigInt(decimals) +
    BigInt(b.padEnd(decimals, "0") || "0")
  ).toString();
}
export type Rules = {
  games: string[];
  defaultGame: string;
  stakeBps: number;
  minStake: string;
  maxStake: string;
  chip: string;
  feeAllocationBps: number;
  minimumFunding: string;
  scheduleMinutes: number;
  maxSessionMinutes: number;
  allIn: boolean;
  quorumBps: number;
  selectedViewer: boolean;
  excludedWallets: string[];
  communityEvBps: number;
  sessionEvBps: number;
  proposalCooldownSeconds: number;
  bonusBuy: boolean;
};
export type Coin = {
  creator?: string;
  id: string;
  name: string;
  ticker: string;
  description: string;
  image: string | null;
  mint: string | null;
  status: string;
  asset: string;
  decimals: number;
  rules: Rules;
  rules_version: number;
  next_session_at: string;
  funding?: string;
  session_state?: string;
  game?: string;
  funds?: Record<string, string>;
  session?: any;
  decision?: any;
  messages?: any[];
  history?: any[];
};
