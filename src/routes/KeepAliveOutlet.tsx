import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { NAV_DONE_EVENT, emitNavDone, emitNavStart } from "../atoms/NavigationProgress";
import { useDevice } from "../hooks/useDevice";
import { useSwipePageOrder, useSwipePager } from "../hooks/useSwipeNavigation";
import { PULL_REMOUNT_EVENT } from "../hooks/usePullToRefresh";

/**
 * KeepAliveOutlet — app-like module switching.
 *
 * Top-level module pages (Projects, Campaigns, Device Info, …) stay mounted
 * after their first visit and are only hidden when the user moves on, so
 * coming back shows their data, filters and scroll position instantly.
 *
 *   • First visit  → centred circle loader until the page reports its data
 *                    is in (emitNavDone) — then the page fades in.
 *   • Later visits → instant, straight from memory.
 *   • Mobile swipe → a real pager: the current page and its neighbour slide
 *                    side by side with the finger.
 *   • Mobile tap   → (bottom bar) the same side-by-side slide, played out.
 *   • Sub-pages (/projects/new, /campaigns/:id, …) are never cached, and
 *     opening one evicts its module's list so it comes back fresh after an edit.
 *
 * Hidden pages are stacked underneath with `visibility: hidden` rather than
 * `display: none`: they stay laid out, so showing one costs no layout pass
 * (no stutter when a swipe starts) and their inner scroll positions survive.
 */

// Module list pages that stay alive. The three SettingConfig tabs share one
// instance (it renders all tabs itself and reads the active one from the url).
const KEEP_ALIVE_PATHS = new Set([
  "/dashboard/admin",
  "/dashboard/manager",
  "/device-info",
  "/projects",
  "/campaigns",
  "/site-maintenance",
  "/activity-logs",
  "/setting-config/api-key-management",
]);
const SETTINGS_TABS = /^\/setting-config\/(user|role|module)-management$/;
const UNCACHED_KEY  = "__outlet";   // remount counter for the plain (non-cached) outlet

function keepAliveKey(pathname: string): string | null {
  if (SETTINGS_TABS.test(pathname)) return "settings";
  return KEEP_ALIVE_PATHS.has(pathname) ? pathname : null;
}

// Mirror of the outlet's cache for callers outside it (bottom bar, sidebar)
const cachedKeys = new Set<string>();

/** True when the page for this path is already alive in memory — opening it is instant */
export function isRouteCached(pathname: string): boolean {
  const key = keepAliveKey(pathname);
  return !!key && cachedKeys.has(key);
}

/** Start the top progress bar only when the page actually has to load */
export function emitNavStartIfNeeded(pathname: string): void {
  if (!isRouteCached(pathname)) emitNavStart();
}

const FIRST_LOAD_TIMEOUT_MS = 6000;   // safety net if a page never reports done
const SLIDE_MS = 280;
const EASE     = "cubic-bezier(0.32, 0.72, 0, 1)";

// Opt-in trace of the pager: run  localStorage.setItem("debug:pager", "1")  and reload
const debugPager = (...args: unknown[]): void => {
  try { if (localStorage.getItem("debug:pager") === "1") console.debug("[pager]", ...args); } catch { /* storage blocked */ }
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Circle loader ──────────────────────────────────────────────────────────────

export const PageCircleLoader: React.FC<{ overlay?: boolean }> = ({ overlay }) => (
  <div
    role="status"
    aria-label="Loading"
    style={{
      position:       overlay ? "absolute" : "relative",
      inset:          overlay ? 0 : undefined,
      flex:           overlay ? undefined : 1,
      zIndex:         overlay ? 50 : undefined,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      minHeight:      200,
    }}
  >
    <span
      className="animate-spin"
      style={{
        width:          34,
        height:         34,
        borderRadius:   "50%",
        border:         "3px solid var(--sc-border)",
        borderTopColor: "var(--primary)",
      }}
    />
  </div>
);

// ── Pane — one cached page ─────────────────────────────────────────────────────

const fill: React.CSSProperties = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 };

/**
 * active   — the page on screen, in normal flow
 * neighbor — sliding in next to it during a swipe
 * leaving  — sliding out during a tap transition
 * hidden   — stacked underneath, laid out but invisible
 */
type PaneMode = "active" | "neighbor" | "leaving" | "hidden";

const KeepAlivePane = React.forwardRef<HTMLDivElement, {
  mode:       PaneMode;
  loading:    boolean;
  transform?: string;
  transition: string;
  children:   React.ReactNode;
}>(({ mode, loading, transform, transition, children }, ref) => {
  const stacked = mode !== "active";
  return (
    <div
      ref={ref}
      aria-hidden={mode !== "active"}
      style={{
        ...fill,
        position:      stacked ? "absolute" : "relative",
        inset:         stacked ? 0 : undefined,
        // Stacked pages are clipped to the viewport so a long hidden page never
        // stretches the scroll area of the one on screen
        overflow:      stacked ? "hidden" : undefined,
        // visibility (not display:none) — fixed FABs inside inherit it and hide too
        visibility:    mode === "hidden" ? "hidden" : undefined,
        pointerEvents: stacked ? "none" : undefined,
        // No transform at rest — a transform would trap the page's fixed children
        transform,
        transition,
        willChange:    transform ? "transform" : undefined,
      }}
    >
      {/* The page mounts and fetches underneath, invisible, then fades in */}
      <div style={{ ...fill, visibility: loading ? "hidden" : "inherit", opacity: loading ? 0 : 1, transition: "opacity 220ms ease" }}>
        <Suspense fallback={<PageCircleLoader />}>{children}</Suspense>
      </div>
      {loading && <PageCircleLoader overlay />}
    </div>
  );
});
KeepAlivePane.displayName = "KeepAlivePane";

// ── Outlet ─────────────────────────────────────────────────────────────────────

interface Drag { dx: number; dest: string | null; settling: boolean }
interface Leaving { key: string; dir: 1 | -1 }   // dir 1 = new page comes from the right

export const KeepAliveOutlet: React.FC = () => {
  const outlet       = useOutlet();
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useDevice();
  const activeKey    = keepAliveKey(pathname);
  const pathnameRef  = useRef(pathname);
  pathnameRef.current = pathname;

  const cacheRef = useRef(new Map<string, React.ReactNode>());
  const cache    = cacheRef.current;
  const paneRefs = useRef(new Map<string, HTMLDivElement>());
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // Opening a module's sub-page (edit / new / detail) drops its cached list,
  // so returning shows fresh data rather than the pre-edit snapshot.
  for (const key of [...cache.keys()]) {
    if (key !== "settings" && pathname.startsWith(`${key}/`)) { cache.delete(key); cachedKeys.delete(key); }
  }

  const isFirstVisit = !!activeKey && !cache.has(activeKey) && !!outlet;
  if (isFirstVisit) { cache.set(activeKey!, outlet); cachedKeys.add(activeKey!); }

  // ── First-visit loader ─────────────────────────────────────────────────────
  // A page's loader clears when it reports done (emitNavDone) while on screen,
  // or after a safety timeout. Neither is cancelled by navigating away — a page
  // left mid-load must not stay stuck behind its loader when it comes back.
  const loaderTimers = useRef(new Map<string, number>());
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const clearPending = useCallback((key: string) => {
    window.clearTimeout(loaderTimers.current.get(key));
    loaderTimers.current.delete(key);
    setPending(p => {
      if (!p.has(key)) return p;
      const next = new Set(p);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const onDone = () => { if (activeKeyRef.current) clearPending(activeKeyRef.current); };
    const timers = loaderTimers.current;
    window.addEventListener(NAV_DONE_EVENT, onDone);
    return () => {
      window.removeEventListener(NAV_DONE_EVENT, onDone);
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [clearPending]);

  // First visit → loader; revisit → report done at once (also clears any loader)
  useEffect(() => {
    if (!activeKey) return;
    if (!isFirstVisit) { emitNavDone(); return; }
    setPending(p => new Set(p).add(activeKey));
    loaderTimers.current.set(activeKey, window.setTimeout(() => clearPending(activeKey), FIRST_LOAD_TIMEOUT_MS));
    // isFirstVisit is derived from the cache for this exact activeKey render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  // ── Pull-to-refresh fallback ────────────────────────────────────────────────
  // A page that registered no refresh of its own is remounted → fresh fetch.
  const [epochs, setEpochs] = useState<Record<string, number>>({});

  useEffect(() => {
    const onRemount = () => {
      const key = activeKeyRef.current ?? UNCACHED_KEY;
      setEpochs(e => ({ ...e, [key]: (e[key] ?? 0) + 1 }));
    };
    window.addEventListener(PULL_REMOUNT_EVENT, onRemount);
    return () => window.removeEventListener(PULL_REMOUNT_EVENT, onRemount);
  }, []);

  // ── Per-page scroll position of the shared <main> scroller ──────────────────
  // Dashboards scroll <main> itself; without this, one page's scroll offset
  // would leak into (and get clamped by) the next page.
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scrollPos  = useRef(new Map<string, number>());
  const mainEl     = () => surfaceRef.current?.closest("main") ?? null;

  useEffect(() => {
    const main = mainEl();
    if (!main) return;
    const onScroll = () => { if (activeKeyRef.current) scrollPos.current.set(activeKeyRef.current, main.scrollTop); };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // ── Swipe pager ─────────────────────────────────────────────────────────────
  const settleTimer = useRef(0);
  const swipedTo    = useRef<string | null>(null);   // this navigation came from the pager
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  useSwipePager(surfaceRef, isMobile && !!activeKey, {
    onDrag: (dx, dest) => {
      window.clearTimeout(settleTimer.current);
      setDrag({ dx, dest, settling: false });
    },
    onRelease: (commit, dest, dx) => {
      window.clearTimeout(settleTimer.current);
      const width = surfaceRef.current?.clientWidth ?? window.innerWidth;
      debugPager("release", { commit, dest, dx: Math.round(dx), from: pathnameRef.current });
      if (commit && dest) {
        // Finish the slide, then switch route — the neighbour is already in place.
        // Do NOT clear the drag here: React Router applies navigate() as a
        // transition, so clearing now would paint the old page back for a frame
        // (the "loads twice" flicker). The route-change layout effect clears it
        // in the same frame the new page becomes active.
        setDrag({ dx: dx < 0 ? -width : width, dest, settling: true });
        settleTimer.current = window.setTimeout(() => {
          swipedTo.current = dest;
          emitNavStartIfNeeded(dest);
          debugPager("navigate", dest);
          navigate(dest);
          // Safety net: if the navigation never lands, don't leave the pages slid
          settleTimer.current = window.setTimeout(() => {
            if (pathnameRef.current !== dest) { debugPager("navigation did not land — reset"); swipedTo.current = null; setDrag(null); }
          }, 800);
        }, SLIDE_MS);
      } else {
        setDrag(d => d && { ...d, dx: 0, settling: true });
        settleTimer.current = window.setTimeout(() => setDrag(null), SLIDE_MS);
      }
    },
  });

  // ── Route change: restore scroll + (mobile tap) play the pager slide ────────
  const order    = useSwipePageOrder();
  const prevPath = useRef(pathname);
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  useLayoutEffect(() => {
    const from    = prevPath.current;
    prevPath.current = pathname;
    if (from === pathname) return;

    // Each page gets back its own scroll offset before the first paint
    const main = mainEl();
    if (main && activeKey) main.scrollTop = scrollPos.current.get(activeKey) ?? 0;

    if (swipedTo.current === pathname) {
      // Pager already slid this page into place — drop the drag state now,
      // inside the same commit, so no in-between frame is ever painted
      swipedTo.current = null;
      window.clearTimeout(settleTimer.current);
      setDrag(null);
      debugPager("route landed", { from, to: pathname });
      return;
    }
    const fromKey = keepAliveKey(from);
    if (!isMobile || !activeKey || !fromKey || fromKey === activeKey || !cache.has(fromKey) || prefersReducedMotion()) return;

    const a = order.indexOf(from);
    const b = order.indexOf(pathname);
    setLeaving({ key: fromKey, dir: a >= 0 && b >= 0 && b < a ? -1 : 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Both pages slide together (WAAPI — no transform stays behind afterwards)
  useLayoutEffect(() => {
    if (!leaving || !activeKey) return;
    const inEl  = paneRefs.current.get(activeKey);
    const outEl = paneRefs.current.get(leaving.key);
    const opts: KeyframeAnimationOptions = { duration: SLIDE_MS, easing: EASE };
    const slideIn  = inEl?.animate([{ transform: `translateX(${leaving.dir * 100}%)` }, { transform: "translateX(0)" }], opts);
    const slideOut = outEl?.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-leaving.dir * 100}%)` }], opts);
    const done = () => setLeaving(l => (l === leaving ? null : l));
    const anim = slideIn ?? slideOut;
    if (anim) anim.finished.then(done, done); else done();
    return () => { slideIn?.cancel(); slideOut?.cancel(); };
  }, [leaving, activeKey]);

  // ── Layout of the panes for this frame ──────────────────────────────────────
  // A settled swipe whose target is now the current route is finished: lay the
  // frame out as final already (the layout effect then just drops the state).
  const landed   = !!drag?.settling && !!drag.dest && drag.dest === pathname;
  const liveDrag = landed ? null : drag;

  const width       = surfaceRef.current?.clientWidth ?? 0;
  const neighborKey = liveDrag?.dest ? keepAliveKey(liveDrag.dest) : null;
  const neighborIsCachedPage = !!neighborKey && neighborKey !== activeKey && cache.has(neighborKey);
  const showPlaceholder      = !!liveDrag?.dest && !neighborIsCachedPage;
  const neighborOffset       = liveDrag ? liveDrag.dx + (liveDrag.dx < 0 ? width : -width) : 0;
  const transition           = liveDrag?.settling ? `transform ${SLIDE_MS}ms ${EASE}` : "none";

  const modeOf = (key: string): PaneMode => {
    if (key === activeKey) return "active";
    if (neighborIsCachedPage && key === neighborKey) return "neighbor";
    if (leaving?.key === key) return "leaving";
    return "hidden";
  };

  const dragTransform = (mode: PaneMode): string | undefined => {
    if (!liveDrag) return undefined;
    if (mode === "active")   return `translateX(${liveDrag.dx}px)`;
    if (mode === "neighbor") return `translateX(${neighborOffset}px)`;
    return undefined;
  };

  return (
    <div
      ref={surfaceRef}
      style={{
        ...fill,
        position:  "relative",
        overflowX: "clip",   // hides the off-screen neighbour without becoming a scroll box
      }}
    >
      {[...cache.entries()].map(([key, element]) => {
        const mode = modeOf(key);
        return (
          <KeepAlivePane
            key={key}
            ref={el => { if (el) paneRefs.current.set(key, el); else paneRefs.current.delete(key); }}
            mode={mode}
            loading={pending.has(key) || (isFirstVisit && key === activeKey)}
            transform={dragTransform(mode)}
            transition={transition}
          >
            <React.Fragment key={epochs[key] ?? 0}>{element}</React.Fragment>
          </KeepAlivePane>
        );
      })}

      {/* Neighbour not visited yet (or the same Settings instance) → loader panel slides in */}
      {showPlaceholder && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, display: "flex", transform: `translateX(${neighborOffset}px)`, transition, pointerEvents: "none" }}
        >
          <PageCircleLoader />
        </div>
      )}

      {!activeKey && (
        <Suspense key={epochs[UNCACHED_KEY] ?? 0} fallback={<PageCircleLoader />}>{outlet}</Suspense>
      )}
    </div>
  );
};

export default KeepAliveOutlet;
