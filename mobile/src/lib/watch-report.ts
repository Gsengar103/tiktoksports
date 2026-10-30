import { useEffect, useRef } from "react";
import { api } from "./api";

export function useWatchReport(videoId: string, token: string | null, active: boolean) {
  const watchId = useRef<string | null>(null);
  const pending = useRef(0);
  const lastSent = useRef(-1);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  function send(id: string, durationMs: number) {
    const current = tokenRef.current;
    if (!current || durationMs === lastSent.current) return;
    lastSent.current = durationMs;
    void api(`/v1/videos/${videoId}/views`, { token: current, body: { watchId: id, durationMs } }).catch(() => {
      lastSent.current = -1;
    });
  }

  const reportDuration = (durationMs: number) => {
    pending.current = durationMs;
    const id = watchId.current;
    if (id) send(id, durationMs);
  };

  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    watchId.current = null;
    pending.current = 0;
    lastSent.current = -1;
    api<{ watchId: string }>(`/v1/videos/${videoId}/views`, { token, body: { durationMs: 0 } })
      .then((result) => {
        if (cancelled) {
          send(result.watchId, pending.current);
          return;
        }
        watchId.current = result.watchId;
        if (pending.current > 0) send(result.watchId, pending.current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      const id = watchId.current;
      if (id) send(id, pending.current);
    };
  }, [active, token, videoId]);

  return reportDuration;
}

export function usePlayedDuration(player: { currentTime: number }, onWatch: (durationMs: number) => void) {
  const onWatchRef = useRef(onWatch);
  onWatchRef.current = onWatch;

  useEffect(() => {
    let watched = 0;
    let last = Number.isFinite(player.currentTime) ? player.currentTime : 0;
    const sample = () => {
      const time = player.currentTime;
      if (Number.isFinite(time)) {
        if (time >= last) watched += (time - last) * 1000;
        last = time;
      }
      onWatchRef.current(Math.max(0, Math.round(watched)));
    };
    const timer = setInterval(sample, 3000);
    return () => {
      clearInterval(timer);
      sample();
    };
  }, [player]);
}
