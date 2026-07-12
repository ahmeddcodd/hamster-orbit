import './styles/main.css';
import { launch } from './game/Game';

// Dev-only harness aid: some embedded/headless panes throttle rAF to zero,
// which stalls the loop. `?softraf` swaps in a timer-driven frame source.
// Never active in production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('softraf')) {
  // MessageChannel tasks are not throttled in background tabs (timers are)
  const mc = new MessageChannel();
  let pending: FrameRequestCallback[] = [];
  let last = 0;
  mc.port1.onmessage = () => {
    if (pending.length === 0) return;
    const now = performance.now();
    if (now - last < 15) {
      mc.port2.postMessage(0);
      return;
    }
    last = now;
    const batch = pending;
    pending = [];
    for (const f of batch) f(now);
  };
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    pending.push(cb);
    mc.port2.postMessage(0);
    return 0;
  };
}

launch();
