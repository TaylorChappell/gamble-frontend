import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteVideoTrack } from "livekit-client";
import { Radio, RefreshCw, VideoOff } from "lucide-react";
import { api } from "./api";

export function Stream({ session, overlay }: { session: any; overlay?: React.ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState("waiting");
  const [retry, setRetry] = useState(0);
  const [fresh, setFresh] = useState(false);
  const latest = useRef(session);
  latest.current = session;
  useEffect(() => {
    let closed = false, attempt = 0, room: Room | undefined, track: RemoteVideoTrack | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let frameCallback = 0, lastFrame = 0, previousTime = -1;
    if (!session || session.ended_at) { setState("waiting"); setFresh(false); return; }
    const element = video.current;
    const receivedFrame = () => {
      if (closed || !element) return;
      lastFrame = Date.now();
      setFresh(true);
      frameCallback = element.requestVideoFrameCallback(receivedFrame);
    };
    if (element?.requestVideoFrameCallback) frameCallback = element.requestVideoFrameCallback(receivedFrame);
    const reconnectLater = () => {
      if (closed || reconnect || attempt >= 5) return;
      const delay = Math.min(30000, 1000 * 2 ** attempt++);
      reconnect = setTimeout(() => { reconnect = undefined; void connect(); }, delay);
    };
    async function connect() {
      if (closed) return;
      const previous = room;
      room = undefined;
      track?.detach(); track = undefined;
      await previous?.disconnect();
      if (closed) return;
      setFresh(false); lastFrame = 0;
      setState("connecting");
      const next = room = new Room({ adaptiveStream: true, dynacast: true });
      next.on(RoomEvent.TrackSubscribed, (t, publication, participant) => {
        if (closed || room !== next || participant.identity !== `publisher:${session.id}` ||
          publication.trackName !== "game" || t.kind !== Track.Kind.Video || !element) return;
        track?.detach();
        track = t as RemoteVideoTrack;
        track.attach(element);
        setState("live");
      });
      next.on(RoomEvent.TrackUnsubscribed, (t) => {
        if (t !== track || room !== next) return;
        t.detach(); track = undefined;
        setFresh(false); setState("reconnecting");
      });
      next.on(RoomEvent.Reconnecting, () => { if (!closed && room === next) { setFresh(false); setState("reconnecting"); } });
      next.on(RoomEvent.Reconnected, () => { if (!closed && room === next) setState(track ? "live" : "connecting"); });
      next.on(RoomEvent.Disconnected, () => {
        if (closed || room !== next) return;
        setFresh(false); setState("disconnected"); reconnectLater();
      });
      try {
        // Every new connection gets a fresh, subscribe-only token.
        const credentials = await api(`/v1/sessions/${session.id}/stream-token`, {});
        if (closed || room !== next) return;
        await next.connect(credentials.url, credentials.token);
        if (closed || room !== next) await next.disconnect();
      } catch {
        if (!closed && room === next) { setState("unavailable"); reconnectLater(); }
      }
    }
    const watch = setInterval(() => {
      if (!element) return;
      // Fallback for browsers without requestVideoFrameCallback.
      if (!element.requestVideoFrameCallback && element.currentTime !== previousTime) {
        previousTime = element.currentTime; lastFrame = Date.now();
      }
      const healthy = lastFrame > 0 && Date.now() - lastFrame < 5000;
      setFresh(healthy);
      if (healthy) attempt = 0;
      if (lastFrame && Date.now() - lastFrame > 10000 && latest.current?.stream_state === "live") reconnectLater();
    }, 1000);
    void connect();
    return () => {
      closed = true;
      clearInterval(watch); clearTimeout(reconnect);
      if (frameCallback) element?.cancelVideoFrameCallback(frameCallback);
      track?.detach();
      void room?.disconnect();
    };
  }, [session?.id, session?.ended_at, retry]);
  const ready = state === "live" && fresh && session?.stream_state === "live" && !session?.ended_at;
  const labels: Record<string, string> = {
    waiting: "The next session starts here.", connecting: "Connecting to the table…",
    reconnecting: "Reconnecting to the table…", unavailable: "The stream is not available yet.",
    disconnected: "The stream disconnected.", live: "Waiting for a fresh game frame…",
  };
  return (
    <div className="stream">
      <video ref={video} autoPlay muted playsInline className={ready ? "" : "invisible"} />
      {!ready && <div className="stream-empty" role="status" aria-live="polite">
        <div className="table-outline" />
        <div className="stream-icon">{state === "waiting" ? <Radio size={30} /> : <VideoOff size={30} />}</div>
        <h2>{session?.stream_state === "paused" ? "Play is paused." : labels[state] || "Waiting for the game feed."}</h2>
        <p>{session?.state === "banking" ? "Cash-out is being reconciled. Rewards follow the confirmed receipt."
          : session?.ended_at ? "This session has ended. The next one uses fresh creator fees."
          : "One shared table. Live community decisions."}</p>
        {["unavailable", "disconnected", "reconnecting"].includes(state) &&
          <button className="button subtle" onClick={() => setRetry((r) => r + 1)}><RefreshCw size={15} />Reconnect</button>}
      </div>}
      <div className="stream-label"><span className={ready ? "dot" : ""} />{ready ? "LIVE BROWSER" : "TABLE OFFLINE"}</div>
      {overlay}
    </div>
  );
}
