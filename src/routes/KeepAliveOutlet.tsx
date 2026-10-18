import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { NAV_DONE_EVENT, emitNavDone, emitNavStart } from "../atoms/NavigationProgress";
import { useDevice } from "../hooks/useDevice";
import { useSwipePageOrder, useSwipePager } from "../hooks/useSwipeNavigation";

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
 *                    side by side with the finger. A visited neighbour shows
 *                    its cached data while sliding in; an unvisited one shows
 *                    the loader.
 *   • Sub-pages (/projects/new, /campaigns/:id, …) are never cached, and
 *     opening one evicts its module's list so it comes back fresh after an edit.
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

function keepAliveKey(pathname: string): string | null {
  if (SETTINGS_TABS.test(pathname)) return "settings";
  return KEEP_ALIVE_PATHS.has(pathname) ? pathname : null;
}

const FIRST_LOAD_TIMEOUT_MS = 6000;   // safety net if a page never reports done
const SLIDE_MS = 280;
const EASE     = "cubic-bezier(0.32, 0.72, 0, 1)";

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

type PaneMode = "active" | "neighbor" | "hidden";

const KeepAlivePane = React.forwardRef<HTMLDivElement, {
  mode:       PaneMode;
  loading:    boolean;
  transform?: string;
  transition: string;
  children:   React.ReactNode;
}>(({ mode, loading, transform, transition, children }, ref) => (
  <div
    ref={ref}
    aria-hidden={mode !== "active"}
    style={{
      ...fill,
      // display:none also hides a hidden page's fixed FABs
      display:    mode === "hidden" ? "none" : "flex",
      position:   mode === "neighbor" ? "absolute" : "relative",
      inset:      mode === "neighbor" ? 0 : undefined,
      // No transform at rest — a transform would trap the page's fixed children
      transform,
      transition,
      pointerEvents: mode === "neighbor" ? "none" : undefined,
    }}
  >
    {/* The page mounts and fetches underneath, invisible, then fades in */}
    <div style={{ ...fill, visibility: loading ? "hidden" : "visible", opacity: loading ? 0 : 1, transition: "opacity 220ms ease" }}>
      <Suspense fallback={<PageCircleLoader />}>{children}</Suspense>
    </div>
    {loading && <PageCircleLoader overlay />}
  </div>
));
KeepAlivePane.displayName = "KeepAlivePane";

// ── Outlet ─────────────────────────────────────────────────────────────────────

interface Drag { dx: number; dest: string | null; settling: boolean }

export const KeepAliveOutlet: React.FC = () => {
  const outlet       = useOutlet();
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { isMobile } = useDevice();
  const activeKey    = keepAliveKey(pathname);

  const cacheRef = useRef(new Map<string, React.ReactNode>());
  const cache    = cacheRef.current;
  const paneRefs = useRef(new Map<string, HTMLDivElement>());
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  // Opening a module's sub-page (edit / new / detail) drops its cached list,
  // so returning shows fresh data rather than the pre-edit snapshot.
  for (const key of [...cache.keys()]) {
    if (key !== "settings" && pathname.startsWith(`${key}/`)) cache.delete(key);
  }

  const isFirstVisit = !!activeKey && !cache.has(activeKey) && !!outlet;
  if (isFirstVisit) cache.set(activeKey!, outlet);

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

  // ── Swipe pager ─────────────────────────────────────────────────────────────
  const surfaceRef  = useRef<HTMLDivElement>(null);
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
      if (commit && dest) {
        // Finish the slide, then switch route — the neighbour is already in place
        setDrag({ dx: dx < 0 ? -width : width, dest, settling: true });
        settleTimer.current = window.setTimeout(() => {
          swipedTo.current = dest;
          emitNavStart();
          navigate(dest);
          setDrag(null);
        }, SLIDE_MS);
      } else {
        setDrag(d => d && { ...d, dx: 0, settling: true });
        settleTimer.current = window.setTimeout(() => setDrag(null), SLIDE_MS);
      }
    },
  });

  // ── Tap navigation (bottom bar / sidebar) gets a short directional slide ────
  const order    = useSwipePageOrder();
  const prevPath = useRef(pathname);
  useLayoutEffect(() => {
    const from = prevPath.current;
    prevPath.current = pathname;
    if (swipedTo.current === pathname) { swipedTo.current = null; return; }   // pager already animated it
    if (!activeKey || prefersReducedMotion()) return;
    const a = order.indexOf(from);
    const b = order.indexOf(pathname);
    const el = paneRefs.current.get(activeKey);
    if (a < 0 || b < 0 || a === b || !el) return;
    el.animate(
      [{ transform: `translateX(${b > a ? 24 : -24}%)`, opacity: 0.4 }, { transform: "translateX(0)", opacity: 1 }],
      { duration: 240, easing: EASE },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Layout of the panes for this frame ──────────────────────────────────────
  const width       = surfaceRef.current?.clientWidth ?? 0;
  const neighborKey = drag?.dest ? keepAliveKey(drag.dest) : null;
  const neighborIsCachedPage = !!neighborKey && neighborKey !== activeKey && cache.has(neighborKey);
  const showPlaceholder      = !!drag?.dest && !neighborIsCachedPage;
  const neighborOffset       = drag ? drag.dx + (drag.dx < 0 ? width : -width) : 0;
  const transition           = drag?.settling ? `transform ${SLIDE_MS}ms ${EASE}` : "none";

  const modeOf = (key: string): PaneMode =>
    key === activeKey ? "active" : neighborIsCachedPage && key === neighborKey ? "neighbor" : "hidden";

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
            transform={!drag || mode === "hidden" ? undefined : `translateX(${mode === "active" ? drag.dx : neighborOffset}px)`}
            transition={transition}
          >
            {element}
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
        <Suspense fallback={<PageCircleLoader />}>{outlet}</Suspense>
      )}
    </div>
  );
};

export default KeepAliveOutlet;
