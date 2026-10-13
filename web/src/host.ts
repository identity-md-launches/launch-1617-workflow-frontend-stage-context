import { createPepeChainBridge } from "./sdk/onchain-bridge.js";
// Register before React renders: a host may send init immediately on iframe load.
export const hostSession = {
  ready: false,
  paused: false,
  channel: null as string | null,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
if (window.parent !== window)
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (
      event.source === window.parent &&
      m?.protocol === "pepe-game/1" &&
      m.type === "init" &&
      typeof m.channel === "string" &&
      m.channel.length > 0 &&
      m.channel.length <= 200
    )
      hostSession.channel = m.channel;
  });
export const hostBridge = createPepeChainBridge({
  onInit: () => {
    hostSession.ready = true;
    notify();
  },
  onPause: () => {
    hostSession.paused = true;
    notify();
  },
  onResume: () => {
    hostSession.paused = false;
    notify();
  },
});
export function subscribeHost(fn: () => void) {
  listeners.add(fn);
  fn();
  return () => {
    listeners.delete(fn);
  };
}
export function reportScore(score: number) {
  if (
    window.parent !== window &&
    hostSession.channel &&
    Number.isSafeInteger(score) &&
    score >= 0
  )
    window.parent.postMessage(
      {
        protocol: "pepe-game/1",
        type: "score",
        channel: hostSession.channel,
        score,
      },
      "*",
    );
}
