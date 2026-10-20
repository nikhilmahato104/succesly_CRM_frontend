import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAccessData } from "../store/slices/accessSlice";
import { selectUserData } from "../store/slices/userSlice";
import { useNavigation } from "../organisms/SidebarV2/hooks/useNavigation";
import type { NavItemType } from "../organisms/SidebarV2/types";

/**
 * Mobile left/right swipe between the bottom-bar pages only
 * (Dashboard ⇄ Device Info ⇄ Campaigns) — same list the bar shows.
 *
 * useSwipePager only reads the gesture — it reports how far the finger has
 * travelled and which page lies that way. KeepAliveOutlet does the rendering:
 * current page and neighbour slide side by side, like a native pager.
 *
 *   • A horizontally scrollable table only hands the gesture over once it is
 *     already scrolled to that edge, so table scrolling keeps working.
 *   • Sub-pages (/projects/new, /campaigns/:id, …) are not in the order → no swipe.
 */

// The frequently used pages on the mobile bottom bar, left → right
const BAR_ROUTES = ["/device-info", "/campaigns"] as const;

const EDGE_GUARD   = 24;    // px from the screen edge — leave the browser's back-swipe alone
const LOCK_SLOP    = 10;    // px before deciding horizontal vs vertical
const COMMIT_RATIO = 0.3;   // drag past 30% of the width always commits
const COMMIT_SPEED = 0.45;  // px/ms flick that commits from a shorter swipe
const RESISTANCE   = 0.25;  // rubber band when there is no page that way

const NO_SWIPE_SELECTOR = "input, textarea, select, [contenteditable='true'], [data-no-swipe]";

function flattenHrefs(items: NavItemType[], out: string[] = []): string[] {
  for (const item of items) {
    if (item.href) out.push(item.href);
    if (item.children) flattenHrefs(item.children, out);
  }
  return out;
}

/**
 * Bottom-bar pages this role can open, in bar order: its dashboard,
 * Device Info, Campaigns. Shared by MobileBottomBar and the swipe pager so
 * the two can never disagree.
 */
export function useBottomBarRoutes(): { dashboard: string | null; devices: string | null; campaigns: string | null; order: string[] } {
  const access   = useSelector((s: any) => selectAccessData(s)) as Record<string, any> | null;
  const userData = useSelector(selectUserData);
  const nav      = useNavigation(access, userData?.role_name || "");

  return useMemo(() => {
    const hrefs     = flattenHrefs(nav);
    const dashboard = hrefs.find(h => h.startsWith("/dashboard")) ?? null;
    const [devicesHref, campaignsHref] = BAR_ROUTES;
    const devices   = hrefs.includes(devicesHref)   ? devicesHref   : null;
    const campaigns = hrefs.includes(campaignsHref) ? campaignsHref : null;
    return { dashboard, devices, campaigns, order: [dashboard, devices, campaigns].filter(Boolean) as string[] };
  }, [nav]);
}

/** Swipe order — only the bottom-bar pages */
export function useSwipePageOrder(): string[] {
  return useBottomBarRoutes().order;
}

/** Whether every horizontal scroller between target and root can't scroll further that way */
function scrollEdges(target: Element, root: Element): { atLeft: boolean; atRight: boolean } {
  let atLeft = true;
  let atRight = true;
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox !== "auto" && ox !== "scroll") continue;
    if (el.scrollLeft > 1) atLeft = false;
    if (el.scrollLeft + el.clientWidth < el.scrollWidth - 1) atRight = false;
  }
  return { atLeft, atRight };
}

export interface SwipePagerHandlers {
  /** Finger moved: dx in px (negative = towards next). dest is null on a rubber-band drag. */
  onDrag:    (dx: number, dest: string | null) => void;
  /** Finger lifted / gesture cancelled */
  onRelease: (commit: boolean, dest: string | null, dx: number) => void;
}

export function useSwipePager(
  surfaceRef: React.RefObject<HTMLElement | null>,
  enabled:    boolean,
  handlers:   SwipePagerHandlers,
): { prev: string | null; next: string | null } {
  const { pathname } = useLocation();
  const order        = useSwipePageOrder();

  const index = order.indexOf(pathname);
  const prev  = index > 0 ? order[index - 1] : null;
  const next  = index >= 0 && index < order.length - 1 ? order[index + 1] : null;

  // Latest values for the native listeners without re-binding on every render
  const latest = useRef({ prev, next, handlers });
  latest.current = { prev, next, handlers };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!enabled || !surface) return;

    let startX = 0, startY = 0, startT = 0, dx = 0;
    let tracking = false;
    let dragging = false;
    let lock: "h" | "v" | null = null;
    let edges = { atLeft: true, atRight: true };

    const destFor = (moveX: number) => {
      const { prev: p, next: n } = latest.current;
      if (moveX < 0) return n && edges.atRight ? n : null;
      return p && edges.atLeft ? p : null;
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (!target || target.closest(NO_SWIPE_SELECTOR)) return;
      if (t.clientX < EDGE_GUARD || t.clientX > window.innerWidth - EDGE_GUARD) return;
      if (!latest.current.prev && !latest.current.next) return;

      startX = t.clientX; startY = t.clientY; startT = e.timeStamp; dx = 0;
      lock = null;
      dragging = false;
      edges = scrollEdges(target, surface);
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t  = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;

      if (!lock) {
        if (Math.abs(mx) < LOCK_SLOP && Math.abs(my) < LOCK_SLOP) return;
        lock = Math.abs(mx) > Math.abs(my) * 1.2 ? "h" : "v";
        // A table still scrolling that way keeps the gesture for itself
        if (lock === "h" && !destFor(mx) && !(mx < 0 ? edges.atRight : edges.atLeft)) lock = "v";
      }
      if (lock === "v") { tracking = false; return; }

      const width = surface.clientWidth || window.innerWidth;
      const dest  = destFor(mx);
      // 1:1 with the finger towards a real page, rubber band at the ends
      dx = dest ? Math.max(-width, Math.min(width, mx)) : mx * RESISTANCE;
      dragging = true;
      latest.current.handlers.onDrag(dx, dest);
    };

    const finish = (commit: boolean) => {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const dest = destFor(dx);
      latest.current.handlers.onRelease(commit && !!dest, dest, dx);
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const width = surface.clientWidth || window.innerWidth;
      const speed = Math.abs(dx) / Math.max(e.timeStamp - startT, 1);
      finish(Math.abs(dx) > width * COMMIT_RATIO || (speed > COMMIT_SPEED && Math.abs(dx) > 30));
    };

    const onCancel = () => { if (tracking) finish(false); };

    // Start on the page; follow / finish on the window so a gesture that ends
    // outside the page (or is interrupted by a tab switch) still settles.
    surface.addEventListener("touchstart",  onStart,  { passive: true });
    window.addEventListener("touchmove",    onMove,   { passive: true });
    window.addEventListener("touchend",     onEnd,    { passive: true });
    window.addEventListener("touchcancel",  onCancel, { passive: true });
    window.addEventListener("blur",         onCancel);
    return () => {
      surface.removeEventListener("touchstart",  onStart);
      window.removeEventListener("touchmove",    onMove);
      window.removeEventListener("touchend",     onEnd);
      window.removeEventListener("touchcancel",  onCancel);
      window.removeEventListener("blur",         onCancel);
    };
  }, [enabled, surfaceRef]);

  return { prev, next };
}
