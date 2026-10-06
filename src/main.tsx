import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  House,
  ArrowUpRight,
  ArrowRight,
  Search,
  Wallet,
  Radio,
  ChevronLeft,
  MessageSquare,
  Send,
  ShieldCheck,
  Clock,
  Coins,
  Plus,
  Check,
  Copy,
  RefreshCw,
  Settings2,
  Pause,
  Play,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import {
  api,
  BASE,
  connectWallet,
  disconnectWallet,
  signLaunch,
  setAuth,
  provider,
  short,
  amount,
  atomic,
  type Auth,
  type Coin,
  type Rules,
} from "./api";
const Stream = React.lazy(() =>
  import("./Stream").then((m) => ({ default: m.Stream })),
);
import "./style.css";
const games = ["blackjack", "roulette", "slots"];
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
const navigate = (path: string) => {
  location.hash = path;
};
function Logo({ coin }: { coin: Coin }) {
  return (
    <span className="coin-logo">
      {coin.image ? (
        <img src={coin.image} alt="" referrerPolicy="no-referrer" />
      ) : (
        coin.ticker.slice(0, 1)
      )}
    </span>
  );
}
function Tag({
  children,
  live = false,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <span className={"tag " + (live ? "on" : "")}>
      {live && <i className="dot" />}
      {children}
    </span>
  );
}
function Empty({
  title: heading,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Radio size={28} />
      <h2>{heading}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/"),
    [auth, setSession] = useState<Auth | null>(null),
    [config, setConfig] = useState<any>(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || "/");
    window.addEventListener("hashchange", change);
    const expired = () => {
      setSession(null);
      setAuth(null);
      notify("Sign in again to continue.");
    };
    window.addEventListener("house:auth-expired", expired);
    const p = provider();
    p?.on?.("accountChanged", expired);
    p?.on?.("disconnect", expired);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("house:auth-expired", expired);
      p?.removeListener?.("accountChanged", expired);
      p?.removeListener?.("disconnect", expired);
    };
  }, []);
  useEffect(() => {
    void api("/v1/config")
      .then(setConfig)
      .catch(() => setConfig({ offline: true }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!auth) return;
    const timer = setTimeout(
      () => {
        setSession(null);
        setAuth(null);
      },
      Math.max(0, auth.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [auth]);
  async function connect() {
    setBusy(true);
    try {
      setSession(await connectWallet());
      notify("Wallet verified.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const disconnect = () => {
    setSession(null);
    setAuth(null);
    void disconnectWallet();
  };
  const props = { auth, notify, config, connect };
  return (
    <>
      <header>
        <a className="brand" href="#/">
          <House size={26} />
          HOUSE
          <i />
        </a>
        <nav>
          <a className={route === "/" ? "active" : ""} href="#/">
            Explore
          </a>
          <a className={route === "/live" ? "active" : ""} href="#/live">
            Live <i className="dot" />
          </a>
          <a className={route === "/rewards" ? "active" : ""} href="#/rewards">
            Rewards
          </a>
        </nav>
        <div className="nav-actions">
          <a className="button ghost launch-link" href="#/launch">
            Launch coin <Plus size={15} />
          </a>
          <button
            className="button primary"
            onClick={auth ? disconnect : connect}
            disabled={busy}
          >
            <Wallet size={15} />
            {auth
              ? short(auth.wallet)
              : busy
                ? "Connecting…"
                : "Connect wallet"}
          </button>
        </div>
      </header>
      {config?.offline ? (
        <div className="status-banner">
          Backend unavailable.{" "}
          {BASE
            ? "Check your connection or try again shortly."
            : "Set VITE_API_URL when building this frontend."}
        </div>
      ) : config && (!config.liveEnabled || config.paused) ? (
        <div className="status-banner">
          <i className="dot" /> Live sessions are not open yet. Browse rooms and
          prepare your coin.
        </div>
      ) : null}
      <main>
        {route.startsWith("/room/") ? (
          <RoomPage id={route.split("/")[2]} {...props} />
        ) : route === "/launch" ? (
          <Launch {...props} />
        ) : route === "/rewards" ? (
          <Rewards {...props} />
        ) : route === "/operations" ? (
          <Operations {...props} />
        ) : (
          <Explore liveOnly={route === "/live"} {...props} />
        )}
      </main>
      <footer>
        <span className="brand small">
          <House size={18} />
          HOUSE
        </span>
        <span>Community at the table.</span>
        <a href="#/launch">
          Launch a coin <ArrowUpRight size={13} />
        </a>
        {auth?.operator && <a href="#/operations">Operations</a>}
      </footer>
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
type Shared = {
  auth: Auth | null;
  notify: (s: string) => void;
  config: any;
  connect: () => void;
};
function Explore({ liveOnly, notify }: Shared & { liveOnly: boolean }) {
  const [coins, setCoins] = useState<Coin[]>([]),
    [state, setState] = useState("loading"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [game, setGame] = useState("all");
  useEffect(() => {
    setState("loading");
    void api("/v1/coins")
      .then((d) => {
        setCoins(d.coins);
        setState("ready");
      })
      .catch(() => setState("offline"));
  }, []);
  const visible = coins.filter(
    (c) =>
      (c.name + " " + c.ticker).toLowerCase().includes(search.toLowerCase()) &&
      (game === "all" || c.rules.games.includes(game)) &&
      (!(liveOnly || filter === "live") ||
        ["live", "voting"].includes(c.session_state || "")) &&
      (filter !== "upcoming" ||
        !c.session_state ||
        ["opening", "funding"].includes(c.session_state)),
  );
  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <i className="dot" />
            THE COMMUNITY HAS A SEAT
          </div>
          <h1>
            The table
            <br />
            is <em>yours.</em>
          </h1>
          <p>
            Creator fees bring the bankroll.
            <br />
            Holders bring the decisions.
          </p>
          <div className="hero-actions">
            <button
              onClick={() =>
                document
                  .getElementById("live-tables")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="button primary"
            >
              Find your table <ArrowRight size={16} />
            </button>
            <a href="#/launch" className="text-link">
              Launch a coin <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="hero-note">
            <ShieldCheck size={15} />
            100% of settled cash-out goes to eligible holders, after disclosed
            costs.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="felt-ring" />
          <div className="art-caption">YOUR COIN. YOUR CALL.</div>
          <div className="paper-card card-one">
            <b>
              A<small>♠</small>
            </b>
            <span>♠</span>
          </div>
          <div className="paper-card card-two">
            <b>
              K<small>♣</small>
            </b>
            <span>♣</span>
          </div>
          <div className="chip">H</div>
          <div className="art-label">
            <i className="dot" />
            Everyone watches. Holders decide.
          </div>
        </div>
      </section>
      <section id="live-tables">
        <div className="section-heading">
          <div>
            <h2>{liveOnly ? "Live tables" : "Find your house"}</h2>
            <p>Watch the game. Join the conversation. Make the call.</p>
          </div>
          <span className="muted">
            {coins.length} {coins.length === 1 ? "room" : "rooms"}
          </span>
        </div>
        <div className="filters">
          <div className="segmented">
            {["all", "live", "upcoming"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? "selected" : ""}
              >
                {f === "all"
                  ? "All tables"
                  : f === "live"
                    ? "Live now"
                    : "Upcoming"}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Search coins"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Game filter"
            value={game}
            onChange={(e) => setGame(e.target.value)}
          >
            <option value="all">All games</option>
            {games.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        {state === "loading" ? (
          <div className="loading">Loading tables…</div>
        ) : state === "offline" ? (
          <Empty
            title="We can’t reach the tables."
            body="The backend may still be starting. Your wallet is safe to disconnect."
            action={
              <button
                className="button ghost"
                onClick={() => location.reload()}
              >
                Try again
              </button>
            }
          />
        ) : visible.length ? (
          <div className="coin-grid">
            {visible.map((c) => (
              <a className="coin-card" href={"#/room/" + c.id} key={c.id}>
                <div
                  className={"card-scene " + (c.game || c.rules.defaultGame)}
                >
                  <Tag
                    live={["live", "voting"].includes(c.session_state || "")}
                  >
                    {c.session_state || c.status}
                  </Tag>
                  <span className="game-label">
                    {title(c.game || c.rules.defaultGame)}
                  </span>
                  <span className="game-symbol">
                    {c.rules.defaultGame === "blackjack"
                      ? "♠"
                      : c.rules.defaultGame === "roulette"
                        ? "◎"
                        : "777"}
                  </span>
                  <span className="watch">
                    Open table <ArrowUpRight size={15} />
                  </span>
                </div>
                <div className="card-body">
                  <div className="identity">
                    <Logo coin={c} />
                    <div>
                      <h3>{c.name}</h3>
                      <small>
                        ${c.ticker} · {c.rules.games.map(title).join(" / ")}
                      </small>
                    </div>
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="card-stats">
                    <div>
                      <small>Next session funds</small>
                      <strong>
                        {amount(c.funding, c.decimals)} <span>{c.asset}</span>
                      </strong>
                    </div>
                    <div>
                      <small>Session schedule</small>
                      <strong>
                        {c.rules.scheduleMinutes}
                        <span> min</span>
                      </strong>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <Empty
            title={
              search || filter !== "all"
                ? "No tables match."
                : "The first house starts with you."
            }
            body="Create a coin room and set its community rules. Live play begins after the funding and provider connections are verified."
            action={
              <a href="#/launch" className="button primary">
                Create your house <Plus size={15} />
              </a>
            }
          />
        )}
      </section>
      <div className="how">
        <span>
          <b>01</b>Creator fees fund the session
        </span>
        <ArrowRight size={14} />
        <span>
          <b>02</b>Holders influence the game
        </span>
        <ArrowRight size={14} />
        <span>
          <b>03</b>Banked cash-out goes to holders
        </span>
      </div>
    </div>
  );
}
function RoomPage({
  id,
  auth,
  notify,
  connect,
  config,
}: Shared & { id: string }) {
  const [coin, setCoin] = useState<Coin | null>(null),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [tab, setTab] = useState("Overview"),
    [chatOpen, setChatOpen] = useState(true),
    [connection, setConnection] = useState("connecting"),
    [weight, setWeight] = useState("0"),
    [optIn, setOptIn] = useState(false),
    [now, setNow] = useState(Date.now()),
    [clockOffset, setClockOffset] = useState(0),
    [versions, setVersions] = useState<any[]>([]);
  const cursor = useRef(0),
    chatBottom = useRef<HTMLDivElement>(null);
  const refresh = () =>
    api("/v1/coins/" + id)
      .then(setCoin)
      .catch((e) => setError(e.message));
  useEffect(() => {
    setCoin(null);
    cursor.current = 0;
    void refresh();
    let stop = false,
      ws: WebSocket,
      timer: ReturnType<typeof setTimeout>;
    const open = () => {
      if (!BASE) return;
      const url = new URL(BASE + "/v1/events");
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("coinId", id);
      url.searchParams.set("after", String(cursor.current));
      ws = new WebSocket(url);
      ws.onopen = () => setConnection("connected");
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.kind === "clock") setClockOffset(d.serverTime - Date.now());
          else {
            cursor.current = Number(d.id);
            void refresh();
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnection("reconnecting");
        if (!stop) timer = setTimeout(open, 2500);
      };
      ws.onerror = () => ws.close();
    };
    open();
    const poll = setInterval(refresh, 10000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(poll);
      ws?.close();
    };
  }, [id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset), 250);
    return () => clearInterval(t);
  }, [clockOffset]);
  useEffect(() => {
    if (!auth) {
      setWeight("0");
      return;
    }
    void api("/v1/coins/" + id + "/position")
      .then((d) => setWeight(d.weight))
      .catch(() => setWeight("0"));
  }, [auth?.wallet, id, coin?.session?.id]);
  useEffect(() => {
    if (
      !auth ||
      !coin?.session ||
      coin.session.ended_at ||
      BigInt(weight) === 0n
    )
      return;
    const beat = () =>
      api(`/v1/sessions/${coin.session.id}/presence`, { optIn }).catch(
        () => {},
      );
    void beat();
    const t = setInterval(beat, 15000);
    return () => clearInterval(t);
  }, [auth?.wallet, coin?.session?.id, coin?.session?.ended_at, optIn, weight]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [coin?.messages?.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const d = await api(`/v1/coins/${id}/chat`, {
        id: crypto.randomUUID(),
        text,
      });
      setText("");
      if (d.acknowledgement) notify(d.acknowledgement);
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  async function vote(choice: string) {
    try {
      const r = await api(`/v1/decisions/${coin?.decision.id}/vote`, {
        choice,
      });
      notify(r.acknowledgement);
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (!coin)
    return (
      <div className="page">
        <Empty
          title={error ? "Room unavailable" : "Opening the table…"}
          body={error || "Connecting to the session server."}
        />
      </div>
    );
  const s = coin.session,
    f = coin.funds || {},
    d = coin.decision,
    active = s && !s.ended_at,
    available = BigInt(f.available || "0"),
    net = s ? available + BigInt(f.stake || "0") - BigInt(s.starting) : 0n;
  const eligible = auth && BigInt(weight) > 0n,
    remaining = d
      ? Math.max(0, Math.ceil((new Date(d.deadline).getTime() - now) / 1000))
      : 0;
  const estimate =
    active && s.totalWeight !== "0"
      ? ((available * BigInt(weight)) / BigInt(s.totalWeight)).toString()
      : "0";
  return (
    <div className="page room-page">
      <div className="room-heading">
        <div className="identity">
          <a href="#/" aria-label="Back">
            <ChevronLeft size={20} />
          </a>
          <Logo coin={coin} />
          <div>
            <h1>
              {coin.name} <small>${coin.ticker}</small>
            </h1>
            <div className="inline">
              <Tag live={s?.state === "live" || s?.state === "voting"}>
                {active
                  ? s.state
                  : coin.status === "active"
                    ? "Waiting for funding"
                    : coin.status}
              </Tag>
              <span className="muted">
                {title(active ? s.game : coin.rules.defaultGame)}
              </span>
            </div>
          </div>
        </div>
        <button className="button ghost" onClick={() => setChatOpen(!chatOpen)}>
          <MessageSquare size={15} />
          {chatOpen ? "Hide chat" : "Show chat"}
        </button>
      </div>
      {coin.status === "draft" && auth?.wallet === coin.creator && (
        <DraftLaunch coinId={coin.id} config={config} notify={notify} />
      )}
      {coin.status === "review" && auth?.operator && (
        <div className="review-note">
          <p>This token launch is verified and awaiting operator activation.</p>
          <button
            className="button primary"
            onClick={() =>
              void api(`/v1/ops/coins/${coin.id}/activate`, {})
                .then(refresh)
                .catch((e) => notify(e.message))
            }
          >
            Activate verified room
          </button>
        </div>
      )}
      <div className={"room-grid " + (!chatOpen ? "no-chat" : "")}>
        <section className="player-panel">
          <div className="player-top">
            <span>HOUSE / {coin.ticker}</span>
            <span>
              {connection === "connected" ? "CONNECTED" : "RECONNECTING"}
            </span>
          </div>
          <React.Suspense
            fallback={
              <div className="stream">
                <div className="stream-empty">Connecting to the player…</div>
              </div>
            }
          >
            <Stream
              session={s}
              overlay={
                d && remaining > 0 ? (
                  <Decision
                    d={d}
                    coin={coin}
                    remaining={remaining}
                    eligible={!!eligible}
                    wallet={auth?.wallet}
                    vote={vote}
                    notify={notify}
                    refresh={refresh}
                  />
                ) : null
              }
            />
          </React.Suspense>
          <div className="player-bottom">
            <span>
              <Radio size={13} />
              Shared browser feed
            </span>
            <span>Votes follow server time · video may be delayed</span>
          </div>
          <div className="session-stats">
            <Stat
              label="Session balance"
              value={amount(active ? f.available : s?.cashout, coin.decimals)}
              suffix={coin.asset}
            />
            <Stat
              label="Stake in play"
              value={amount(active ? f.stake : "0", coin.decimals)}
              suffix={coin.asset}
            />
            <Stat
              label="Net session result"
              value={
                (net > 0n ? "+" : "") +
                amount(
                  active
                    ? net.toString()
                    : s?.cashout
                      ? (BigInt(s.cashout) - BigInt(s.starting)).toString()
                      : "0",
                  coin.decimals,
                )
              }
              suffix={coin.asset}
            />
            <Stat
              label="Next session fees"
              value={amount(f.next, coin.decimals)}
              suffix={coin.asset}
            />
          </div>
        </section>
        {chatOpen && (
          <aside className="chat-panel">
            <div className="chat-heading">
              <h2>Table chat</h2>
              <Tag live={connection === "connected"}>
                {connection === "connected" ? "Connected" : "Reconnecting"}
              </Tag>
            </div>
            <div className="chat-intro">
              The conversation shapes the game.
              <br />
              Holder votes count once, by eligible weight.
            </div>
            <div className="chat-messages" aria-live="polite">
              {!coin.messages?.length && (
                <p className="muted">Be the first to join the conversation.</p>
              )}
              {coin.messages?.map((m) => (
                <div className="message" key={m.id}>
                  <div>
                    <strong>{short(m.wallet)}</strong>
                    <time>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{m.text}</p>
                  {m.acknowledgement && (
                    <small>
                      <Check size={11} />
                      {m.acknowledgement.replaceAll("_", " ")}
                    </small>
                  )}
                </div>
              ))}
              <div ref={chatBottom} />
            </div>
            <div className="chat-bottom">
              {auth ? (
                <form onSubmit={send}>
                  <input
                    aria-label="Chat message"
                    placeholder="Say something. Make a call."
                    maxLength={400}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <button
                    aria-label="Send message"
                    disabled={!text.trim() || sending}
                  >
                    <Send size={17} />
                  </button>
                </form>
              ) : (
                <button className="button ghost full" onClick={connect}>
                  Connect to join chat
                </button>
              )}
              <small>
                AI interprets chat. Published rules control every action.
              </small>
            </div>
          </aside>
        )}
      </div>
      <div className="room-below">
        <section>
          <div className="tabs">
            {["Overview", "Session history", "Rules"].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === "Rules")
                    void api(`/v1/coins/${id}/rules`).then((d) =>
                      setVersions(d.versions),
                    );
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Overview" ? (
            <div className="overview">
              <h3>A shared bankroll. A community call.</h3>
              <p>
                {coin.description ||
                  "Creator fees fund this room. Eligible holders influence play and receive the full banked cash-out after actual costs."}
              </p>
              <p>
                Sessions run for up to {coin.rules.maxSessionMinutes} minutes,
                with funding opportunities every {coin.rules.scheduleMinutes}{" "}
                minutes. Continuing a session can lose the entire active
                balance.
              </p>
              {coin.mint ? (
                <a
                  className="text-link"
                  href={"https://pump.fun/coin/" + coin.mint}
                  target="_blank"
                  rel="noreferrer"
                >
                  View verified token on Pump.fun <ExternalLink size={14} />
                </a>
              ) : (
                <Tag>Token not launched</Tag>
              )}
            </div>
          ) : tab === "Rules" ? (
            <div className="overview">
              <p>
                Reward and vote weights use time-weighted holdings fixed before
                the session. A majority means more than 50% of participating
                eligible weight.
              </p>
              {versions.map((v) => (
                <details key={v.version}>
                  <summary>
                    Rules version {v.version} ·{" "}
                    {new Date(v.created_at).toLocaleDateString()}
                  </summary>
                  <RulesSummary
                    rules={v.rules}
                    decimals={coin.decimals}
                    asset={coin.asset}
                  />
                </details>
              ))}
            </div>
          ) : (
            <div className="history">
              {coin.history?.length ? (
                coin.history.map((h) => (
                  <div className="receipt" key={h.id}>
                    <div>
                      <strong>{title(h.game)}</strong>
                      <small>
                        {new Date(h.started_at).toLocaleString()} · {h.state}
                      </small>
                    </div>
                    <div>
                      <small>Starting funds</small>
                      {amount(h.starting, coin.decimals)}
                    </div>
                    <div>
                      <small>Cash-out</small>
                      {h.cashout === null
                        ? "Pending"
                        : amount(h.cashout, coin.decimals)}
                    </div>
                    <div>
                      <small>Actual costs</small>
                      {h.cost === null
                        ? "Pending"
                        : amount(h.cost, coin.decimals)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No sessions yet.</p>
              )}
            </div>
          )}
        </section>
        <aside className="position">
          <div className="inline">
            <Wallet size={17} />
            <h3>Your position</h3>
          </div>
          <p>
            {auth
              ? eligible
                ? "Eligible for this session"
                : "No eligible weight in this session"
              : "Connect to see your participation"}
          </p>
          {eligible && (
            <>
              <small>Estimated holder allocation</small>
              <strong>
                {amount(estimate, coin.decimals)} {coin.asset}
              </strong>
              <p>
                Unsecured estimate. Claimable only after cash-out receipt and
                reconciliation.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                />
                Opt in to selected-viewer turns
              </label>
            </>
          )}
          <a className="button ghost full" href="#/rewards">
            View rewards <ArrowUpRight size={14} />
          </a>
        </aside>
      </div>
    </div>
  );
}
function DraftLaunch({
  coinId,
  config,
  notify,
}: {
  coinId: string;
  config: any;
  notify: (message: string) => void;
}) {
  const [prepared, setPrepared] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function prepare() {
    setBusy(true);
    try {
      setPrepared(await api(`/v1/coins/${coinId}/launch/prepare`, {}));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    setBusy(true);
    try {
      if (new Date(prepared.expiresAt).getTime() <= Date.now())
        throw Error("Prepare a fresh launch transaction.");
      const signature = await signLaunch(prepared.transaction);
      await api(`/v1/coins/${coinId}/launch/confirm`, { signature });
      notify("Token launch confirmed. Awaiting operator activation.");
      location.reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="review-note" style={{ marginBottom: 20, marginTop: 0 }}>
      <p>
        {prepared
          ? prepared.summary
          : "This is your saved room configuration. No token has been created yet."}
      </p>
      {prepared ? (
        <button className="button primary" disabled={busy} onClick={sign}>
          Review and sign launch
        </button>
      ) : (
        <button
          className="button ghost"
          disabled={busy || !config?.liveEnabled || config?.missing?.length > 0}
          onClick={prepare}
        >
          Prepare token launch
        </button>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong>
        {value}
        <span>{suffix}</span>
      </strong>
    </div>
  );
}
function Decision({
  d,
  coin,
  remaining,
  eligible,
  wallet,
  vote,
  notify,
  refresh,
}: any) {
  const [chips, setChips] = useState<Record<string, string>>({}),
    [chip, setChip] = useState("");
  useEffect(() => {
    setChips({});
    setChip(coin.session?.rules?.chip || coin.rules.chip);
  }, [d.id]);
  const unit = coin.decimals,
    fmt = (n: string) => amount(n, unit) + " " + coin.asset;
  const headings: Record<string, string> = {
    bank: "Bank it, or keep playing?",
    blackjack: "What’s the move?",
    all_in: "Put it all on the table?",
    bonus: "Buy the bonus?",
    game: "Change the game?",
    bet: "Raise the stakes?",
    roulette: "Make the call.",
    viewer: "Your turn at the table.",
  };
  const total = Object.values(d.tallies || {}).reduce(
    (n: any, w: any) => n + BigInt(w),
    0n,
  ) as bigint;
  const budget = BigInt(d.payload.budget || "0"),
    spent = Object.values(chips).reduce((n, w) => n + BigInt(w), 0n);
  function place(spot: string) {
    if (!chip) return;
    const n = BigInt(chip);
    if (spent + n > budget) return;
    setChips({ ...chips, [spot]: (BigInt(chips[spot] || "0") + n).toString() });
  }
  async function confirm() {
    try {
      await api(`/v1/decisions/${d.id}/selected`, { chips });
      notify("Your play is confirmed");
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <div className="decision" role="region" aria-label="Live decision">
      <div className="decision-top">
        <span className="eyebrow">
          {d.kind === "viewer" ? "SELECTED HOLDER" : "COMMUNITY DECISION"}
        </span>
        <span className="countdown">
          <Clock size={12} />
          {remaining}s
        </span>
      </div>
      <h2>{headings[d.kind] || "Make the call"}</h2>
      {d.kind === "bank" ? (
        <p>
          Cash-out {fmt(d.payload.cashout)} · Started{" "}
          {fmt(coin.session.starting)}.<br />A tie or no votes banks and
          distributes.
        </p>
      ) : d.kind === "all_in" ? (
        <p className="risk">
          Stake {fmt(d.payload.stake)}. A loss ends this session with 0 to
          distribute. {coin.rules.quorumBps / 100}% participation required.
        </p>
      ) : d.kind === "viewer" ? (
        <p>
          {short(d.payload.selected)} is at the table. Budget:{" "}
          {fmt(d.payload.budget)}. Timeout uses the published preset.
        </p>
      ) : (
        <p>
          {d.payload.stake ? "Exact stake: " + fmt(d.payload.stake) + ". " : ""}
          {d.payload.game ? "Next game: " + title(d.payload.game) + ". " : ""}
          {d.payload.recommended
            ? "Recommended: " + title(d.payload.recommended) + ". "
            : ""}
          Each eligible wallet has one current ballot.
        </p>
      )}
      {d.kind === "viewer" ? (
        wallet === d.payload.selected ? (
          <>
            {coin.session.game === "roulette" && (
              <>
                <div className="chip-controls">
                  <select
                    aria-label="Chip size"
                    value={chip}
                    onChange={(e) => setChip(e.target.value)}
                  >
                    {[1n, 5n, 10n].map((m) => (
                      <option
                        value={(BigInt(coin.rules.chip) * m).toString()}
                        key={m.toString()}
                      >
                        {fmt((BigInt(coin.rules.chip) * m).toString())}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setChips({})}>Undo all</button>
                  <span>{fmt((budget - spent).toString())} left</span>
                </div>
                <div className="chip-board">
                  {[
                    "red",
                    "black",
                    ...Array.from({ length: 37 }, (_, i) => String(i)),
                  ].map((n) => (
                    <button
                      onClick={() => place(n)}
                      key={n}
                      className={chips[n] ? "has-chip" : ""}
                    >
                      {n}
                      {chips[n] && <small>{amount(chips[n], unit)}</small>}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              className="button primary full"
              disabled={coin.session.game === "roulette" && spent !== budget}
              onClick={confirm}
            >
              {coin.session.game === "slots"
                ? "Spin once"
                : "Confirm placement"}
            </button>
          </>
        ) : (
          <p className="muted">Watch for the selected holder’s play.</p>
        )
      ) : (
        <div className="decision-buttons">
          {d.options.map((choice: string) => {
            const share = total
              ? Number((BigInt(d.tallies?.[choice] || "0") * 100n) / total)
              : 0;
            return (
              <button
                disabled={!eligible}
                onClick={() => vote(choice)}
                key={choice}
              >
                <span>
                  {choice === "bank"
                    ? "Bank and distribute"
                    : choice === "continue"
                      ? "Continue playing"
                      : title(choice)}
                </span>
                <small>{share}%</small>
              </button>
            );
          })}
        </div>
      )}
      <div className="decision-foot">
        {d.kind === "viewer"
          ? "A button press does not change the odds."
          : eligible
            ? "Later valid choices replace your earlier vote."
            : "Watch freely. Session-eligible holdings are required to vote."}
      </div>
      <div className="timer-track">
        <i
          style={{
            width: `${Math.min(100, (remaining / (d.kind === "viewer" ? 20 : 15)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
function Rewards({ auth, connect, notify }: Shared) {
  const [claims, setClaims] = useState<any[]>([]),
    [loading, setLoading] = useState(false);
  const refresh = () => api("/v1/rewards").then((d) => setClaims(d.claims));
  useEffect(() => {
    if (auth) void refresh().catch((e) => notify(e.message));
    else setClaims([]);
  }, [auth?.wallet]);
  async function claim(id: string) {
    setLoading(true);
    try {
      await api("/v1/claims/" + id, {});
      notify("Claim queued. It will show as paid after confirmation.");
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div className="eyebrow">YOUR SHARE OF THE TABLE</div>
        <h1>
          Good calls.
          <br />
          <em>Real receipts.</em>
        </h1>
        <p>Settled rewards, down to the last unit.</p>
      </div>
      {!auth ? (
        <Empty
          title="Your rewards are tied to your wallet."
          body="Sign in to see claimable allocations and previous payouts."
          action={
            <button className="button primary" onClick={connect}>
              Connect wallet
            </button>
          }
        />
      ) : (
        <>
          <div className="reward-note">
            <ShieldCheck size={24} />
            <div>
              <h3>Cash-out belongs to holders.</h3>
              <p>
                100% of the confirmed session cash-out, including starting
                funds, is allocated after actual disclosed costs. Pending
                withdrawals are never claimable.
              </p>
            </div>
          </div>
          {claims.length ? (
            claims.map((c) => (
              <div className="reward-row" key={c.id}>
                <div className="coin-logo">{c.ticker[0]}</div>
                <div>
                  <h3>{c.name}</h3>
                  <small>
                    {c.state} · {new Date(c.created_at).toLocaleDateString()}
                  </small>
                </div>
                <strong>
                  {amount(c.amount, c.decimals)} <small>{c.asset}</small>
                </strong>
                {c.state === "claimable" ? (
                  <button
                    disabled={loading}
                    className="button primary"
                    onClick={() => claim(c.id)}
                  >
                    Claim
                  </button>
                ) : (
                  <Tag>{c.state}</Tag>
                )}
                {c.tx_ref && (
                  <button
                    title="Copy transaction reference"
                    className="icon-button"
                    onClick={() => {
                      void navigator.clipboard.writeText(c.tx_ref);
                      notify("Transaction reference copied");
                    }}
                  >
                    <Copy size={15} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="Nothing to claim yet."
              body="Your first allocation will appear here after a session banks and its withdrawal is confirmed."
              action={
                <a href="#/" className="button ghost">
                  Explore tables
                </a>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
const defaultRules: Rules = {
  games: ["blackjack", "roulette", "slots"],
  defaultGame: "blackjack",
  stakeBps: 500,
  minStake: "1000000",
  maxStake: "100000000000",
  chip: "1000000",
  feeAllocationBps: 10000,
  minimumFunding: "100000000",
  scheduleMinutes: 20,
  maxSessionMinutes: 10,
  allIn: false,
  quorumBps: 2000,
  selectedViewer: true,
  excludedWallets: [],
  communityEvBps: 500,
  sessionEvBps: 100,
  proposalCooldownSeconds: 120,
  bonusBuy: false,
};
function RulesSummary({
  rules: r,
  decimals,
  asset,
}: {
  rules: Rules;
  decimals: number;
  asset: string;
}) {
  return (
    <ul className="rules-list">
      <li>
        {r.feeAllocationBps / 100}% of supported creator fees fund sessions. No
        HOUSE platform cut.
      </li>
      <li>
        {r.games.map(title).join(", ")}. Starts with {title(r.defaultGame)}.
      </li>
      <li>
        Normal stake: {r.stakeBps / 100}% of available funds, within provider
        limits. Minimum {amount(r.minStake, decimals)} {asset}. Legal blackjack
        doubles or splits reserve additional stake before execution.
      </li>
      <li>
        Funding opportunity every {r.scheduleMinutes} minutes; session maximum{" "}
        {r.maxSessionMinutes} minutes, after outstanding play settles.
      </li>
      <li>
        {r.allIn
          ? `All-in enabled. Requires majority and ${r.quorumBps / 100}% eligible weight participation. Total loss is possible.`
          : "All-in proposals disabled."}
      </li>
      <li>
        Bank votes at +25%, +50%, +100%, −25%, or half peak-profit giveback
        after reaching +50%. At least two minutes between prompts.
      </li>
      <li>
        Banking distributes 100% of confirmed cash-out, including initial funds,
        less actual disclosed costs. No retained house bankroll.
      </li>
      <li>
        Rewards and votes use fixed time-weighted holdings. Excluded accounts:{" "}
        {r.excludedWallets.length
          ? r.excludedWallets.map(short).join(", ")
          : "None configured — creator must identify treasury, burn and LP accounts before launch."}
      </li>
      <li>
        Rounding uses largest remainders; ties sort by wallet address. Every
        atomic unit goes to holders.
      </li>
      <li>
        Selected-viewer turns{" "}
        {r.selectedViewer
          ? "enabled: uniformly selected from present, opted-in eligible wallets, with a 10-minute cooldown"
          : "disabled"}
        . Slot bonus buys {r.bonusBuy ? "enabled" : "disabled"}.
      </li>
    </ul>
  );
}
function Launch({ auth, connect, config, notify }: Shared) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(""),
    [ticker, setTicker] = useState(""),
    [image, setImage] = useState(""),
    [description, setDescription] = useState(""),
    [rules, setRules] = useState<Rules>(defaultRules),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<string | null>(null),
    [prepared, setPrepared] = useState<any>(null);
  const decimals = config?.decimals ?? 9,
    asset = config?.asset || "SOL";
  const update = (key: keyof Rules, value: any) =>
    setRules((r) => ({ ...r, [key]: value }));
  const money = (key: keyof Rules, label: string) => (
    <label>
      {label} ({asset})
      <input
        defaultValue={amount(rules[key] as string, decimals).replaceAll(
          ",",
          "",
        )}
        inputMode="decimal"
        onBlur={(e) => {
          try {
            update(key, atomic(e.target.value, decimals));
          } catch (err) {
            notify((err as Error).message);
          }
        }}
      />
    </label>
  );
  async function save() {
    setBusy(true);
    try {
      const c = await api("/v1/coins", {
        name,
        ticker,
        description,
        image: image || null,
        rules,
      });
      setDraft(c.id);
      notify("Coin room saved. No token or funds have moved.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    setBusy(true);
    try {
      setPrepared(await api(`/v1/coins/${draft}/launch/prepare`, {}));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function launch() {
    setBusy(true);
    try {
      if (new Date(prepared.expiresAt).getTime() <= Date.now())
        throw Error("Launch preparation expired. Prepare it again.");
      const signature = await signLaunch(prepared.transaction);
      await api(`/v1/coins/${draft}/launch/confirm`, { signature });
      notify("Launch confirmed. The room is awaiting operator activation.");
      navigate("/room/" + draft);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page launch-page">
      <div className="page-heading">
        <div className="eyebrow">BUILD YOUR HOUSE</div>
        <h1>
          A coin with
          <br />
          <em>a seat at the table.</em>
        </h1>
        <p>Keep it simple. Set the rules. Let the community play.</p>
      </div>
      <div className="launch-steps">
        {["Your coin", "The table", "Review"].map((s, i) => (
          <button
            disabled={!!draft}
            key={s}
            onClick={() => setStep(i + 1)}
            className={step === i + 1 ? "selected" : ""}
          >
            <b>{i + 1}</b>
            {s}
          </button>
        ))}
      </div>
      <div className="launch-form">
        {draft ? (
          <>
            <Tag>ROOM SAVED</Tag>
            <h2>{name} is ready for the next step.</h2>
            <p>
              Saving a room does not create a Pump.fun token. Launching requires
              the configured, verified Pump.fun integration.
            </p>
            <a className="button ghost" href={"#/room/" + draft}>
              Open room <ArrowUpRight size={15} />
            </a>
            {prepared ? (
              <div className="review-note">
                <p>{prepared.summary}</p>
                <p>
                  Review every instruction and fee in your wallet before
                  signing.
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={launch}
                >
                  Sign and launch token
                </button>
              </div>
            ) : (
              <button
                className="button primary"
                disabled={
                  busy || !config?.liveEnabled || config?.missing?.length > 0
                }
                onClick={prepare}
              >
                Prepare launch transaction
              </button>
            )}
          </>
        ) : (
          <>
            {step === 1 ? (
              <>
                <h2>Give your coin a name.</h2>
                <p>A familiar face for your community.</p>
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={name}
                      maxLength={40}
                      placeholder="Your coin name"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Ticker
                    <input
                      value={ticker}
                      maxLength={10}
                      placeholder="HOUSE"
                      onChange={(e) =>
                        setTicker(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, ""),
                        )
                      }
                    />
                  </label>
                </div>
                <label>
                  Logo URL
                  <input
                    value={image}
                    type="url"
                    placeholder="https://…"
                    onChange={(e) => setImage(e.target.value)}
                  />
                  <small>Use a permanent HTTPS image URL.</small>
                </label>
                <label>
                  Description
                  <textarea
                    rows={4}
                    value={description}
                    maxLength={1000}
                    placeholder="What brings your community together?"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
              </>
            ) : step === 2 ? (
              <>
                <h2>Set the table.</h2>
                <p>These rules are fixed for each session.</p>
                <div className="game-picker">
                  {games.map((g) => (
                    <button
                      key={g}
                      className={rules.games.includes(g) ? "selected" : ""}
                      onClick={() => {
                        const gs = rules.games.includes(g)
                          ? rules.games.filter((x) => x !== g)
                          : [...rules.games, g];
                        if (gs.length)
                          setRules({
                            ...rules,
                            games: gs,
                            defaultGame: gs.includes(rules.defaultGame)
                              ? rules.defaultGame
                              : gs[0],
                          });
                      }}
                    >
                      <span>
                        {g === "blackjack"
                          ? "♠"
                          : g === "roulette"
                            ? "◎"
                            : "777"}
                      </span>
                      <strong>{title(g)}</strong>
                      {rules.games.includes(g) && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <div className="form-grid">
                  <label>
                    Default game
                    <select
                      value={rules.defaultGame}
                      onChange={(e) => update("defaultGame", e.target.value)}
                    >
                      {rules.games.map((g) => (
                        <option key={g} value={g}>
                          {title(g)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Creator fees allocated (%)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={rules.feeAllocationBps / 100}
                      onChange={(e) =>
                        update(
                          "feeAllocationBps",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={rules.selectedViewer}
                    onChange={(e) => update("selectedViewer", e.target.checked)}
                  />
                  Selected-holder turns
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={rules.allIn}
                    onChange={(e) => update("allIn", e.target.checked)}
                  />
                  Allow all-in community votes
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={rules.bonusBuy}
                    onChange={(e) => update("bonusBuy", e.target.checked)}
                  />
                  Allow slot bonus-buy proposals
                </label>
                <details>
                  <summary>
                    <Settings2 size={15} />
                    Advanced settings
                  </summary>
                  <div className="form-grid">
                    <label>
                      Normal stake (%)
                      <input
                        type="number"
                        value={rules.stakeBps / 100}
                        onChange={(e) =>
                          update("stakeBps", Number(e.target.value) * 100)
                        }
                      />
                    </label>
                    <label>
                      All-in quorum (%)
                      <input
                        type="number"
                        value={rules.quorumBps / 100}
                        onChange={(e) =>
                          update("quorumBps", Number(e.target.value) * 100)
                        }
                      />
                    </label>
                    {money("minimumFunding", "Minimum session funds")}
                    {money("minStake", "Minimum stake")}
                    {money("maxStake", "Maximum stake")}
                    {money("chip", "Chip increment")}
                    <label>
                      Funding interval (minutes)
                      <input
                        type="number"
                        value={rules.scheduleMinutes}
                        onChange={(e) =>
                          update("scheduleMinutes", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Session duration (minutes)
                      <input
                        type="number"
                        value={rules.maxSessionMinutes}
                        onChange={(e) =>
                          update("maxSessionMinutes", Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Excluded wallets
                    <textarea
                      placeholder="Treasury, burn, LP and other non-beneficiary addresses, one per line"
                      onChange={(e) =>
                        update(
                          "excludedWallets",
                          e.target.value.split(/\s+/).filter(Boolean),
                        )
                      }
                    />
                  </label>
                </details>
              </>
            ) : (
              <>
                <h2>Your rules, in plain English.</h2>
                <p>
                  {name || "Your coin"} · ${ticker || "TICKER"}
                </p>
                <RulesSummary rules={rules} decimals={decimals} asset={asset} />
                <div className="review-note">
                  <ShieldCheck size={18} />
                  <p>
                    Saving creates a room configuration. It does not sign a
                    transaction, launch a token, or start gambling.
                  </p>
                </div>
              </>
            )}
            <div className="form-actions">
              {step > 1 ? (
                <button
                  className="button ghost"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <button
                  className="button primary"
                  disabled={step === 1 && (!name || ticker.length < 2)}
                  onClick={() => setStep(step + 1)}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : auth ? (
                <button
                  className="button primary"
                  disabled={busy || !name || ticker.length < 2}
                  onClick={save}
                >
                  {busy ? "Saving…" : "Save coin room"}
                </button>
              ) : (
                <button className="button primary" onClick={connect}>
                  Connect to create
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function Operations({ auth, connect, notify }: Shared) {
  const [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/v1/ops")
      .then(setData)
      .catch((e) => notify(e.message));
  useEffect(() => {
    if (auth?.operator) void refresh();
  }, [auth?.wallet]);
  async function pause() {
    setBusy(true);
    try {
      await api("/v1/ops/pause", { paused: !data.paused });
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!auth?.operator)
    return (
      <div className="page">
        <Empty
          title="Operator access required."
          body="This view is restricted to configured operator wallets."
          action={
            !auth ? (
              <button className="button primary" onClick={connect}>
                Connect wallet
              </button>
            ) : undefined
          }
        />
      </div>
    );
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div className="eyebrow">PRIVATE OPERATIONS</div>
        <h1>
          Keep the house
          <br />
          <em>in order.</em>
        </h1>
      </div>
      {data ? (
        <>
          <div className="ops-toolbar">
            <Tag>{data.paused ? "Globally paused" : "Running"}</Tag>
            <button className="button ghost" disabled={busy} onClick={refresh}>
              <RefreshCw size={15} />
              Refresh
            </button>
            <button className="button primary" disabled={busy} onClick={pause}>
              {data.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {data.paused ? "Resume services" : "Emergency pause"}
            </button>
          </div>
          <h2>Connections</h2>
          <p className="muted">
            {data.missing.length
              ? "Required: " + data.missing.join(", ")
              : "All configuration present. Provider and browser acceptance testing is still required."}
          </p>
          <h2>Workers</h2>
          {data.workers.length ? (
            data.workers.map((w: any) => (
              <div className="receipt" key={w.id}>
                <strong>{w.kind}</strong>
                <Tag>
                  {Date.now() - new Date(w.last_seen).getTime() < 15000
                    ? w.status
                    : "stale"}
                </Tag>
                <span>{new Date(w.last_seen).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <p className="muted">No worker heartbeat yet.</p>
          )}
          <h2>Active sessions</h2>
          {data.sessions.map((s: any) => (
            <div className="receipt" key={s.id}>
              <a href={"#/room/" + s.coin_id}>
                {short(s.id)} <ArrowUpRight size={13} />
              </a>
              <Tag>{s.state}</Tag>
              <span>{s.error_code || s.stream_state}</span>
              {s.state === "paused" && s.browser_failures > 0 && (
                <button className="button ghost small" onClick={() =>
                  void api(`/v1/ops/sessions/${s.id}/reconnect-browser`, {})
                    .then(refresh).catch((e) => notify(e.message))}>
                  Reconnect browser
                </button>
              )}
              {s.state === "paused" && (
                <button
                  className="button ghost small"
                  onClick={() =>
                    void api(`/v1/ops/sessions/${s.id}/resume`, {})
                      .then(refresh)
                      .catch((e) => notify(e.message))
                  }
                >
                  Resume after reconciliation
                </button>
              )}
            </div>
          ))}
          <h2>Unresolved commands</h2>
          {data.commands.length ? (
            data.commands.map((c: any) => (
              <div className="receipt" key={c.id}>
                <strong>{c.kind}</strong>
                <Tag>{c.state}</Tag>
                <span>{c.error_code || "Provider rejected"}</span>
                <small>{short(c.id)}</small>
              </div>
            ))
          ) : (
            <p className="muted">No unresolved commands.</p>
          )}
          <details>
            <summary>AI usage and failed jobs</summary>
            <pre>
              {JSON.stringify({ ai: data.ai, jobs: data.jobs }, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <p>Loading operations…</p>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
