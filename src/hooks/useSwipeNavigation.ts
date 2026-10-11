import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAccessData } from "../store/slices/accessSlice";
import { selectUserData } from "../store/slices/userSlice";
import { useNavigation } from "../organisms/SidebarV2/hooks/useNavigation";
import type { NavItemType } from "../organisms/SidebarV2/types";
import { emitNavStart } from "../atoms/NavigationProgress";

/**
 * useSwipeNavigation — mobile left/right swipe between top-level pages,
 * in the same order as the sidebar (e.g. Device Info ⇄ Projects ⇄ Campaigns).
 *
 *   • Swipe left  → next page, swipe right → previous page.
 *   • The page follows the finger, then the new page slides in from that side.
 *   • A horizontally scrollable table only hands the gesture over once it is
 *     already scrolled to that edge, so table scrolling keeps working.
 *   • Sub-pages (/projects/new, /campaigns/:id, …) are not in the order → no swipe.
 */

// Settings sidebar entry → the individual SettingConfig tabs, each gated on its module
const SETTINGS_TABS: Array<[moduleId: string, href: string]> = [
  ["user_management",   "/setting-config/user-management"],
  ["role_management",   "/setting-config/role-management"],
  ["module_management", "/setting-config/module-management"],
];

const EDGE_GUARD   = 24;    // px from the screen edge — leave the browser's back-swipe alone
const LOCK_SLOP    = 10;    // px before deciding horizontal vs vertical
const DRAG_FACTOR  = 0.45;  // how far the page follows the finger
const COMMIT_DIST  = 80;    // px of finger travel that always commits
const COMMIT_SPEED = 0.45;  // px/ms flick that commits from a shorter swipe
const SLIDE_MS     = 260;
const EASE         = "cubic-bezier(0.32, 0.72, 0, 1)";

const NO_SWIPE_SELECTOR = "input, textarea, select, [contenteditable='true'], [data-no-swipe]";

// Survives a DashboardLayout remount between routes
let pendingSlideFrom: "left" | "right" | null = null;

function flattenHrefs(items: NavItemType[], out: string[] = []): string[] {
  for (const item of items) {
    if (item.href) out.push(item.href);
    if (item.children) flattenHrefs(item.children, out);
  }
  return out;
}

function useSwipePageOrder(): string[] {
  const access   = useSelector((s: any) => selectAccessData(s)) as Record<string, any> | null;
  const userData = useSelector(selectUserData);
  const nav      = useNavigation(access, userData?.role_name || "");

  return useMemo(() => {
    const settingsTabs = SETTINGS_TABS.filter(([id]) => access?.[id]?.view).map(([, href]) => href);
    return flattenHrefs(nav).flatMap(href =>
      href === "/setting-config/user-management" ? settingsTabs : [href],
    );
  }, [nav, access]);
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

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useSwipeNavigation(
  surfaceRef: React.RefObject<HTMLElement | null>,   // receives the touches
  pageRef:    React.RefObject<HTMLElement | null>,   // moves with the finger / slides in
  enabled:    boolean,
): void {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const order        = useSwipePageOrder();

  const index = order.indexOf(pathname);
  const prev  = index > 0 ? order[index - 1] : null;
  const next  = index >= 0 && index < order.length - 1 ? order[index + 1] : null;

  // Latest targets for the native listeners without re-binding on every render
  const targetsRef = useRef({ prev, next });
  targetsRef.current = { prev, next };

  // ── Incoming page slides in from the swipe side ───────────────────────────
  useLayoutEffect(() => {
    const from = pendingSlideFrom;
    pendingSlideFrom = null;
    const el = pageRef.current;
    if (!from || !el || prefersReducedMotion()) return;
    el.animate(
      [
        { transform: `translateX(${from === "right" ? 30 : -30}%)`, opacity: 0 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: SLIDE_MS, easing: EASE },
    );
  }, [pathname, pageRef]);

  // ── Gesture ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!enabled || !surface) return;

    let startX = 0, startY = 0, startT = 0, dx = 0;
    let tracking = false;
    let lock: "h" | "v" | null = null;
    let edges = { atLeft: true, atRight: true };

    const page = () => pageRef.current;

    const setOffset = (px: number, animate: boolean) => {
      const el = page();
      if (!el) return;
      el.style.transition = animate ? `transform ${SLIDE_MS}ms ${EASE}, opacity ${SLIDE_MS}ms ${EASE}` : "none";
      el.style.transform  = px ? `translateX(${px}px)` : "";
      el.style.opacity    = px ? String(1 - Math.min(Math.abs(px) / window.innerWidth, 0.5)) : "";
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (!target || target.closest(NO_SWIPE_SELECTOR)) return;
      if (t.clientX < EDGE_GUARD || t.clientX > window.innerWidth - EDGE_GUARD) return;
      const { prev: p, next: n } = targetsRef.current;
      if (!p && !n) return;

      startX = t.clientX; startY = t.clientY; startT = e.timeStamp; dx = 0;
      lock = null;
      edges = scrollEdges(target, surface);
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;

      if (!lock) {
        if (Math.abs(mx) < LOCK_SLOP && Math.abs(my) < LOCK_SLOP) return;
        lock = Math.abs(mx) > Math.abs(my) * 1.2 ? "h" : "v";
      }
      if (lock === "v") { tracking = false; return; }

      // Only follow the finger when there is a page that way and nothing left to scroll
      const { prev: p, next: n } = targetsRef.current;
      const allowed = mx < 0 ? !!n && edges.atRight : !!p && edges.atLeft;
      dx = allowed ? mx : 0;
      setOffset(dx * DRAG_FACTOR, false);
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (lock !== "h" || !dx) { setOffset(0, true); return; }

      const speed  = Math.abs(dx) / Math.max(e.timeStamp - startT, 1);
      const commit = Math.abs(dx) > COMMIT_DIST || (speed > COMMIT_SPEED && Math.abs(dx) > 30);
      const { prev: p, next: n } = targetsRef.current;
      const dest = dx < 0 ? n : p;

      if (!commit || !dest) { setOffset(0, true); return; }

      setOffset(0, false);
      pendingSlideFrom = dx < 0 ? "right" : "left";
      emitNavStart();
      navigate(dest);
    };

    const onCancel = () => { if (tracking) { tracking = false; setOffset(0, true); } };

    surface.addEventListener("touchstart",  onStart,  { passive: true });
    surface.addEventListener("touchmove",   onMove,   { passive: true });
    surface.addEventListener("touchend",    onEnd,    { passive: true });
    surface.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      surface.removeEventListener("touchstart",  onStart);
      surface.removeEventListener("touchmove",   onMove);
      surface.removeEventListener("touchend",    onEnd);
      surface.removeEventListener("touchcancel", onCancel);
      setOffset(0, false);
    };
  }, [enabled, surfaceRef, pageRef, navigate]);
}
