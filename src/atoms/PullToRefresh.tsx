import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { refreshActivePage } from "../hooks/usePullToRefresh";

/**
 * Instagram-style pull-to-refresh for the whole app (mobile only).
 *
 * Wraps the content inside <main>. When the touched list and <main> are both
 * scrolled to the top, pulling down drags the page with a rubber band and
 * reveals a tick spinner in the gap above it; the ticks fill in as you pull.
 * Past the threshold (light haptic) a release holds the page open with the
 * spinner turning until the page's data is back, then glides it home.
 *
 * The page gets a transform only while pulled — at rest there is none, so
 * fixed children (FABs, floating pager) are never trapped.
 */

const THRESHOLD   = 64;    // px of page travel that triggers a refresh
const HOLD        = 52;    // px the page stays open while refreshing
const MAX_PULL    = 160;   // rubber band asymptote
const RESISTANCE  = 0.75;
const LOCK_SLOP   = 8;     // px before deciding pull vs swipe / scroll
const MIN_SPIN_MS = 700;   // spinner shows at least this long — no blink
const MAX_SPIN_MS = 10000;
const SETTLE_MS   = 380;
const EASE        = "cubic-bezier(0.32, 0.72, 0, 1)";
const TICKS       = 8;

// Forms and tools hold unsaved input — a remount there would wipe it
const NO_PULL_ROUTES   = /(\/(new|edit)$)|^\/tools\//;
const NO_PULL_SELECTOR = "input, textarea, select, [contenteditable='true'], [data-no-pull]";

const damp  = (dy: number) => MAX_PULL * (1 - 1 / ((dy * RESISTANCE) / MAX_PULL + 1));
const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

/** Every scroller from the touch point up to <main> is at its top */
function atTop(target: Element, root: Element): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
    if (el === root) break;
  }
  return true;
}

// A finished pull must not also count as a tap on the card under the finger
function swallowNextClick() {
  const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 350);
}

const SPINNER_CSS = `
  @keyframes ptr-spin { to { transform: rotate(360deg) } }
  .ptr-spinning { animation: ptr-spin 0.8s steps(${TICKS}) infinite }
`;

export const PullToRefresh: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => {
  const { pathname } = useLocation();
  const active       = enabled && !NO_PULL_ROUTES.test(pathname);

  const contentRef   = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tickRefs     = useRef<(SVGLineElement | null)[]>([]);
  const busy         = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const content  = contentRef.current;
    const scroller = content?.parentElement;
    if (!active || !content || !scroller) return;

    let startX = 0, startY = 0, dist = 0;
    let tracking = false, pulling = false, armed = false;

    const paint = (d: number, settle: boolean) => {
      content.style.transition = settle ? `transform ${SETTLE_MS}ms ${EASE}` : "none";
      content.style.transform  = d > 0 ? `translate3d(0, ${d}px, 0)` : "";
      const p = Math.min(d / THRESHOLD, 1);
      const ind = indicatorRef.current;
      if (ind) {
        // Fades while gliding home instead of vanishing mid-slide
        ind.style.transition = settle ? `opacity ${SETTLE_MS}ms ease` : "none";
        ind.style.opacity    = String(busy.current ? 1 : p);
      }
      // Ticks appear one by one, clockwise from the top
      if (!busy.current) tickRefs.current.forEach((t, i) => { if (t) t.style.opacity = p >= (i + 1) / TICKS ? "1" : "0"; });
    };

    const run = async () => {
      busy.current = true;
      setRefreshing(true);
      tickRefs.current.forEach(t => { if (t) t.style.opacity = ""; });   // back to the graded spinner look
      paint(HOLD, true);
      const started = Date.now();
      try {
        await Promise.race([refreshActivePage(), sleep(MAX_SPIN_MS)]);
      } catch { /* the page shows its own error toast */ }
      const left = MIN_SPIN_MS - (Date.now() - started);
      if (left > 0) await sleep(left);
      busy.current = false;
      paint(0, true);
      window.setTimeout(() => setRefreshing(false), SETTLE_MS);
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      if (busy.current || e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (!target || target.closest(NO_PULL_SELECTOR) || !atTop(target, scroller)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dist = 0; pulling = false; armed = false;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const mx = e.touches[0].clientX - startX;
      const my = e.touches[0].clientY - startY;

      if (!pulling) {
        if (Math.abs(mx) < LOCK_SLOP && Math.abs(my) < LOCK_SLOP) return;
        // Only a downward, mostly-vertical drag is a pull — the rest is scroll / page swipe
        if (my <= 0 || my < Math.abs(mx) * 1.2) { tracking = false; return; }
        pulling = true;
      }
      if (e.cancelable) e.preventDefault();

      dist = damp(Math.max(0, my - LOCK_SLOP));
      if (!armed && dist >= THRESHOLD) { armed = true; navigator.vibrate?.(10); }
      else if (armed && dist < THRESHOLD) armed = false;
      paint(dist, false);
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!pulling) return;
      swallowNextClick();
      if (dist >= THRESHOLD) run(); else paint(0, true);
    };

    const onCancel = () => {
      if (!tracking) return;
      tracking = false;
      if (pulling) paint(0, true);
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove",  onMove,  { passive: false });
    window.addEventListener("touchend",     onEnd,   { passive: true });
    window.addEventListener("touchcancel",  onCancel, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",     onEnd);
      window.removeEventListener("touchcancel",  onCancel);
      if (!busy.current) paint(0, false);
    };
  }, [active]);

  return (
    <div
      ref={contentRef}
      style={{ flex: 1, boxSizing: "border-box", display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}
    >
      {active && (
        // Sits just above the page, revealed in the gap as the page is pulled down
        <div
          ref={indicatorRef}
          aria-hidden={!refreshing}
          role={refreshing ? "status" : undefined}
          aria-label={refreshing ? "Refreshing" : undefined}
          style={{
            position: "absolute", left: 0, right: 0, top: 0, height: HOLD,
            transform: "translateY(-100%)", opacity: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", color: "var(--fi-muted)",
          }}
        >
          <style>{SPINNER_CSS}</style>
          <svg width="26" height="26" viewBox="0 0 26 26" className={refreshing ? "ptr-spinning" : undefined}>
            {Array.from({ length: TICKS }).map((_, i) => (
              <line
                key={i}
                ref={el => { tickRefs.current[i] = el; }}
                x1="13" y1="3" x2="13" y2="8.5"
                stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                transform={`rotate(${(360 / TICKS) * i} 13 13)`}
                // Graded trail while spinning — the leading tick is the brightest
                style={{ strokeOpacity: refreshing ? 1 - ((TICKS - i) % TICKS) * 0.1 : 1, opacity: 0 }}
              />
            ))}
          </svg>
        </div>
      )}
      {children}
    </div>
  );
};

export default PullToRefresh;
