import { useEffect, useRef, type RefObject } from "react";
import { NAV_DONE_EVENT } from "../atoms/NavigationProgress";

/**
 * Global pull-to-refresh plumbing. The gesture itself lives in <PullToRefresh>
 * (DashboardLayout, mobile only); a pull refreshes whatever page is on screen:
 *
 *   • Components that registered with usePullRefresh — only the ones inside the
 *     visible page (KeepAliveOutlet marks hidden pages aria-hidden).
 *   • Nothing registered → the page is remounted for a fresh fetch
 *     (PULL_REMOUNT_EVENT, handled by KeepAliveOutlet) and the spinner waits
 *     for the page's emitNavDone().
 */

export const PULL_REMOUNT_EVENT = "app:pull-remount";

const REMOUNT_TIMEOUT_MS = 4000;   // safety net if the remounted page never reports done

type Entry = { el: () => Element | null; run: () => Promise<void> | void };
const registry = new Set<Entry>();

const isOnScreen = (el: Element | null) =>
  !!el && el.isConnected && !el.closest('[aria-hidden="true"]');

function waitForNavDone(timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener(NAV_DONE_EVENT, done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    window.addEventListener(NAV_DONE_EVENT, done);
  });
}

/** Refresh the page on screen — resolves once its data is back */
export async function refreshActivePage(): Promise<void> {
  const active = [...registry].filter(e => isOnScreen(e.el()));
  if (active.length) {
    await Promise.all(active.map(e => e.run()));
    return;
  }
  const done = waitForNavDone(REMOUNT_TIMEOUT_MS);
  window.dispatchEvent(new CustomEvent(PULL_REMOUNT_EVENT));
  await done;
}

/**
 * Hand the pull-to-refresh of the page holding `ref` to `refresh`.
 * Return a promise that settles when the new data is in — the spinner waits for it.
 */
export function usePullRefresh(
  ref:     RefObject<Element | null>,
  refresh: (() => Promise<void> | void) | undefined,
): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  const enabled = !!refresh;

  useEffect(() => {
    if (!enabled) return;
    const entry: Entry = { el: () => ref.current, run: () => latest.current?.() };
    registry.add(entry);
    return () => { registry.delete(entry); };
  }, [enabled, ref]);
}
