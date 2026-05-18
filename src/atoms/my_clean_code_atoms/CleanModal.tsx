import React, { Fragment, useCallback, useEffect, useRef, useState } from "react"; // useRef kept for BottomSheet drag system
import {
  Dialog, DialogPanel, DialogTitle,
  Transition, TransitionChild,
} from "@headlessui/react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useDevice } from "../../hooks/useDevice";

// ── Public props ───────────────────────────────────────────────────────────

export interface CleanModalProps {
  isOpen:           boolean;
  onClose:          () => void;
  title?:           string;
  subtitle?:        string;
  children?:        React.ReactNode;
  footer?:          React.ReactNode;
  maxWidth?:        number | string;
  maxHeight?:       string;
  closeOnBackdrop?: boolean;
  headerExtra?:     React.ReactNode;
  zIndex?:          number;
  /** Show expand/collapse icon before the close button (default: true) */
  expandable?:      boolean;
  /** "auto" (default) = mobile→sheet, desktop→modal  |  "modal" = always centered  |  "sheet" = always bottom sheet */
  mode?:            "auto" | "modal" | "sheet";
}

// ── Constants ──────────────────────────────────────────────────────────────

const PARTIAL_RATIO      = 0.65;
const MAX_RATIO          = 0.98;
const DISMISS_THRESHOLD  = 100;
const EXPAND_THRESHOLD   = 60;
const COLLAPSE_THRESHOLD = 80;
const SNAP_MS            = 280;
const DISMISS_MS         = 220;
const BODY_DRAG_MIN_PX   = 6;

// Backdrop values at each sheet position
const BLUR_PARTIAL = 3;   // blur px when sheet is at 65 dvh
const BLUR_CAP     = 7;   // blur px when sheet is at 98 dvh
const ALPHA_PARTIAL = 0.30;
const ALPHA_CAP     = 0.55;

type SnapTimer    = ReturnType<typeof setTimeout> | null;
type SnapTimerRef = React.MutableRefObject<SnapTimer>;

// ── DOM helpers ────────────────────────────────────────────────────────────

function setStyle(el: HTMLDivElement, css: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, css);
}

function clearStyles(el: HTMLDivElement | null) {
  if (!el) return;
  setStyle(el, { height: "", borderRadius: "", transform: "", transition: "" });
}

// Returns a [0..1] visibility ratio used to drive backdrop blur.
function applyLiveDrag(
  el: HTMLDivElement, dy: number,
  startH: number, maxH: number, isExpanded: boolean,
): number {
  const partialH = Math.round(maxH * PARTIAL_RATIO);
  const capH     = Math.round(maxH * MAX_RATIO);
  let   visRatio = 1;

  if (isExpanded) {
    const newH  = Math.min(capH, Math.max(partialH, startH - dy));
    const ratio = Math.max(0, (newH - partialH) / Math.max(1, startH - partialH));
    const br    = (12 + 4 * (1 - ratio)).toFixed(1);
    setStyle(el, { height: `${newH}px`, borderRadius: `${br}px ${br}px 0 0`, transition: "none" });
    if (newH <= partialH) {
      const extra = dy - (startH - partialH);
      el.style.transform = `translateY(${extra}px)`;
      visRatio = Math.max(0, (newH - extra) / capH);
    } else {
      el.style.transform = "";
      visRatio = newH / capH;
    }
  } else if (dy < 0) {
    const newH  = Math.min(capH, startH + Math.abs(dy));
    const ratio = (newH - startH) / Math.max(1, capH - startH);
    const br    = (16 - 4 * ratio).toFixed(1);
    setStyle(el, { height: `${newH}px`, borderRadius: `${br}px ${br}px 0 0`, transform: "", transition: "none" });
    visRatio = newH / capH;
  } else {
    setStyle(el, { transform: `translateY(${dy}px)`, transition: "none" });
    visRatio = Math.max(0, (startH - dy) / capH);
  }

  return visRatio;
}

function snapTo(
  el: HTMLDivElement | null, targetH: number, toExpanded: boolean,
  snapTimerRef: SnapTimerRef, cb?: () => void,
) {
  if (!el) { cb?.(); return; }
  if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
  const br = toExpanded ? 12 : 16;
  setStyle(el, {
    height:       `${targetH}px`,
    borderRadius: `${br}px ${br}px 0 0`,
    transform:    "translateY(0)",
    transition:   `transform ${SNAP_MS}ms ease, height ${SNAP_MS}ms cubic-bezier(0.4,0,0.2,1), border-radius ${SNAP_MS}ms ease`,
  });
  snapTimerRef.current = setTimeout(() => {
    snapTimerRef.current = null;
    clearStyles(el);
    cb?.();
  }, SNAP_MS + 10);
}

// Fix: lock current rendered height before animating so CSS height doesn't
// snap (e.g., from mid-collapse 70dvh back to 98dvh before sliding down).
function animateDismiss(
  el: HTMLDivElement | null,
  snapTimerRef: SnapTimerRef,
  cb: () => void,
) {
  if (!el) { cb(); return; }
  if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
  const h = el.getBoundingClientRect().height;  // lock actual current height
  setStyle(el, {
    height:     `${h}px`,
    transform:  "translateY(100%)",
    transition: `transform ${DISMISS_MS}ms cubic-bezier(0.4,0,1,1)`,
  });
  snapTimerRef.current = setTimeout(() => {
    snapTimerRef.current = null;
    clearStyles(el);
    cb();
  }, DISMISS_MS + 10);
}

// ── Release logic ──────────────────────────────────────────────────────────

type DragOpts = {
  onDismiss:     () => void;
  onExpand:      () => void;
  onCollapse:    () => void;
  isExpandedRef: React.MutableRefObject<boolean>;
  snapTimerRef:  SnapTimerRef;
  onVisRatio:    (ratio: number) => void;  // drives backdrop blur during drag
};

function handlePartialRelease(el: HTMLDivElement | null, dy: number, startH: number, maxH: number, opts: DragOpts) {
  const capH = Math.round(maxH * MAX_RATIO);
  if (dy < -EXPAND_THRESHOLD) return snapTo(el, capH, true, opts.snapTimerRef, opts.onExpand);
  if (dy > DISMISS_THRESHOLD) return opts.onDismiss();
  snapTo(el, startH, false, opts.snapTimerRef);
}

function handleExpandedRelease(el: HTMLDivElement | null, dy: number, startH: number, maxH: number, opts: DragOpts) {
  const partialH  = Math.round(maxH * PARTIAL_RATIO);
  const capH      = Math.round(maxH * MAX_RATIO);
  const extraDrag = dy - (startH - partialH);
  if (dy > COLLAPSE_THRESHOLD && extraDrag > DISMISS_THRESHOLD) return opts.onDismiss();
  if (dy > COLLAPSE_THRESHOLD) return snapTo(el, partialH, false, opts.snapTimerRef, opts.onCollapse);
  snapTo(el, capH, true, opts.snapTimerRef);
}

// ── Drag hook ──────────────────────────────────────────────────────────────

function useDrag(
  panelRef: React.RefObject<HTMLDivElement | null>,
  bodyRef:  React.RefObject<HTMLDivElement | null>,
  opts:     DragOpts,
) {
  const startY    = useRef(0);
  const startH    = useRef(0);
  const maxH      = useRef(0);
  const active    = useRef(false);
  const pending   = useRef(false);
  const pendAtTop = useRef(false);
  const optsRef   = useRef(opts);
  optsRef.current = opts;

  const h = useRef({
    capture(e: React.PointerEvent, originY: number) {
      startY.current  = originY;
      startH.current  = panelRef.current?.getBoundingClientRect().height ?? 0;
      maxH.current    = panelRef.current?.parentElement?.getBoundingClientRect().height ?? window.innerHeight;
      active.current  = true;
      pending.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    move(clientY: number) {
      if (!panelRef.current || !active.current) return;
      const ratio = applyLiveDrag(
        panelRef.current, clientY - startY.current,
        startH.current, maxH.current, optsRef.current.isExpandedRef.current,
      );
      optsRef.current.onVisRatio(ratio);
    },
    release(clientY: number) {
      if (!active.current) return;
      active.current = false;
      const dy = clientY - startY.current;
      const el = panelRef.current;
      optsRef.current.isExpandedRef.current
        ? handleExpandedRelease(el, dy, startH.current, maxH.current, optsRef.current)
        : handlePartialRelease(el, dy, startH.current, maxH.current, optsRef.current);
    },
    cancel() { active.current = false; pending.current = false; },
  }).current;

  const zone = useRef({
    onPointerDown: (e: React.PointerEvent) => h.capture(e, e.clientY),
    onPointerMove: (e: React.PointerEvent) => h.move(e.clientY),
    onPointerUp:   (e: React.PointerEvent) => h.release(e.clientY),
  }).current;

  const body = useRef({
    onPointerDown(e: React.PointerEvent) {
      const el = bodyRef.current;
      if (!el) return;
      const atTop = el.scrollTop <= 0;
      const atBot = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      if (!atTop && !atBot) return;
      pending.current   = true;
      pendAtTop.current = atTop;
      startY.current    = e.clientY;
    },
    onPointerMove(e: React.PointerEvent) {
      if (active.current) { h.move(e.clientY); return; }
      if (!pending.current) return;
      const dy = e.clientY - startY.current;
      if (Math.abs(dy) < BODY_DRAG_MIN_PX) return;
      if (pendAtTop.current || dy > 0) h.capture(e, startY.current);
      else pending.current = false;
    },
    onPointerUp:     (e: React.PointerEvent) => { pending.current = false; h.release(e.clientY); },
    onPointerCancel: () => h.cancel(),
  }).current;

  return { zone, body };
}

// ── Backdrop ───────────────────────────────────────────────────────────────
// forwardRef so BottomSheet can animate blur in sync with drag position.

const Backdrop = React.forwardRef<HTMLDivElement>((_, ref) => (
  <TransitionChild
    as={Fragment}
    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
    leave="ease-in duration-300" leaveFrom="opacity-100" leaveTo="opacity-0"
  >
    <div
      ref={ref}
      style={{
        position: "fixed", inset: 0,
        background:    `rgba(0,0,0,${ALPHA_PARTIAL})`,
        backdropFilter: `blur(${BLUR_PARTIAL}px)`,
        WebkitBackdropFilter: `blur(${BLUR_PARTIAL}px)`,
      }}
    />
  </TransitionChild>
));
Backdrop.displayName = "Backdrop";

// Simple backdrop for desktop — no ref needed
const SimpleBackdrop: React.FC = () => (
  <TransitionChild
    as={Fragment}
    enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
    leave="ease-in duration-300" leaveFrom="opacity-100" leaveTo="opacity-0"
  >
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }} />
  </TransitionChild>
);

// ── Shared UI ──────────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6, border: "none",
  background: "transparent", cursor: "pointer", color: "var(--fi-muted)",
  transition: "background 140ms ease, color 140ms ease",
};

const CloseBtn: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <button
    type="button" onClick={onClose} aria-label="Close"
    onPointerDown={e => e.stopPropagation()}
    style={iconBtnStyle}
    onMouseEnter={e => { const b = e.currentTarget; b.style.background = "var(--sb-hover)"; b.style.color = "var(--fi-text)"; }}
    onMouseLeave={e => { const b = e.currentTarget; b.style.background = "transparent"; b.style.color = "var(--fi-muted)"; }}
  >
    <X style={{ width: 15, height: 15 }} />
  </button>
);

const ExpandBtn: React.FC<{ expanded: boolean; onToggle: () => void }> = ({ expanded, onToggle }) => (
  <button
    type="button" onClick={onToggle} aria-label={expanded ? "Collapse" : "Expand"}
    onPointerDown={e => e.stopPropagation()}
    style={iconBtnStyle}
    onMouseEnter={e => { const b = e.currentTarget; b.style.background = "var(--sb-hover)"; b.style.color = "var(--fi-text)"; }}
    onMouseLeave={e => { const b = e.currentTarget; b.style.background = "transparent"; b.style.color = "var(--fi-muted)"; }}
  >
    {expanded
      ? <Minimize2 style={{ width: 14, height: 14 }} />
      : <Maximize2 style={{ width: 14, height: 14 }} />}
  </button>
);

const ModalHeader: React.FC<{
  title?: string; subtitle?: string; headerExtra?: React.ReactNode;
  expandControl?: React.ReactNode; onClose: () => void;
}> = ({ title, subtitle, headerExtra, expandControl, onClose }) => {
  if (!title && !headerExtra) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--fi-border)", background: "var(--modal-bg)" }}>
      <div style={{ minWidth: 0 }}>
        {title && <DialogTitle style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fi-text)", lineHeight: 1.3 }}>{title}</DialogTitle>}
        {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--fi-muted)", lineHeight: 1.4 }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {headerExtra}
        {expandControl}
        <CloseBtn onClose={onClose} />
      </div>
    </div>
  );
};

const ModalBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="sc-scrollbar" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "var(--modal-bg)" }}>
    {children}
  </div>
);

const ModalFooter: React.FC<{ footer: React.ReactNode }> = ({ footer }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: "1px solid var(--fi-border)", flexShrink: 0, background: "var(--modal-bg)" }}>
    {footer}
  </div>
);

// ── Desktop modal ──────────────────────────────────────────────────────────

const DesktopModal: React.FC<CleanModalProps> = ({
  isOpen, onClose, title, subtitle, children, footer,
  maxWidth = 720, maxHeight = "90vh", closeOnBackdrop = false,
  headerExtra, zIndex = 9999, expandable = true,
}) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { if (!isOpen) setExpanded(false); }, [isOpen]);

  // Pure state flip — CSS transitions handle the animation because both
  // normal (maxHeight) and expanded (100vh) are explicit length values.
  const toggleExpand = useCallback(() => setExpanded(v => !v), []);

  const expandControl = expandable
    ? <ExpandBtn expanded={expanded} onToggle={toggleExpand} />
    : null;

  // Expandable modals use maxHeight as a fixed height so CSS can transition
  // between two concrete values (maxHeight ↔ 100vh). Non-expandable modals
  // (confirm dialogs) keep height:auto for natural content sizing.
  const panelH    = expanded ? "100vh" : (expandable ? maxHeight : "auto");
  const panelMaxH = expanded ? "100vh" : maxHeight;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" style={{ position: "relative", zIndex }} onClose={closeOnBackdrop ? onClose : () => {}}>
        <SimpleBackdrop />
        <div style={{
          position: "fixed", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: expanded ? 0 : 16,
          transition: "padding 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95 translate-y-4" enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100 translate-y-0" leaveTo="opacity-0 scale-95 translate-y-4"
          >
            <DialogPanel
              style={{
                width:         "100%",
                maxWidth:      expanded ? "100vw" : maxWidth,
                height:        panelH,
                maxHeight:     panelMaxH,
                display:       "flex",
                flexDirection: "column",
                borderRadius:  expanded ? 0 : 12,
                background:    "var(--modal-bg)",
                boxShadow:     "0 20px 60px rgba(0,0,0,0.2)",
                overflow:      "hidden",
                border:        "1px solid var(--fi-border)",
                transition:    [
                  "opacity 0.2s ease-out",
                  "transform 0.2s ease-out",
                  "max-width 0.28s cubic-bezier(0.4,0,0.2,1)",
                  "height 0.28s cubic-bezier(0.4,0,0.2,1)",
                  "max-height 0.28s cubic-bezier(0.4,0,0.2,1)",
                  "border-radius 0.28s cubic-bezier(0.4,0,0.2,1)",
                  "box-shadow 0.28s ease",
                  "border 0.28s ease",
                ].join(", "),
              }}
            >
              <ModalHeader title={title} subtitle={subtitle} headerExtra={headerExtra} expandControl={expandControl} onClose={onClose} />
              <ModalBody>{children}</ModalBody>
              {footer && <ModalFooter footer={footer} />}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

// ── Mobile bottom sheet ────────────────────────────────────────────────────

const BottomSheet: React.FC<CleanModalProps> = ({
  isOpen, onClose: parentOnClose,
  title, subtitle, children, footer,
  closeOnBackdrop = false, headerExtra, zIndex = 9999,
}) => {
  const panelRef      = useRef<HTMLDivElement>(null);
  const bodyRef       = useRef<HTMLDivElement>(null);
  const backdropRef   = useRef<HTMLDivElement>(null);
  const snapTimerRef  = useRef<SnapTimer>(null);
  const isExpandedRef = useRef(false);
  const [expanded, setExpandState] = useState(false);

  const setExpand = useCallback((v: boolean) => {
    isExpandedRef.current = v;
    setExpandState(v);
  }, []);

  // Drive backdrop blur from panel visibility ratio [0..1]
  const setBackdrop = useCallback((ratio: number, withTransition = false) => {
    const el = backdropRef.current;
    if (!el) return;
    const blur  = BLUR_PARTIAL  + (BLUR_CAP  - BLUR_PARTIAL)  * ratio;
    const alpha = ALPHA_PARTIAL + (ALPHA_CAP - ALPHA_PARTIAL) * ratio;
    el.style.transition = withTransition
      ? `backdrop-filter ${SNAP_MS}ms ease, background ${SNAP_MS}ms ease`
      : "none";
    el.style.backdropFilter        = `blur(${blur.toFixed(1)}px)`;
    el.style.WebkitBackdropFilter  = `blur(${blur.toFixed(1)}px)`;
    el.style.background            = `rgba(0,0,0,${alpha.toFixed(2)})`;
  }, []);

  // On re-open: cancel any pending timer and reverse any in-progress dismiss
  useEffect(() => {
    if (isOpen) {
      if (snapTimerRef.current) { clearTimeout(snapTimerRef.current); snapTimerRef.current = null; }
      const el = panelRef.current;
      if (el && el.style.transform) {
        el.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.4,0,0.2,1)`;
        el.style.transform  = "translateY(0)";
        const tid = setTimeout(() => { el.style.transform = ""; el.style.transition = ""; }, SNAP_MS + 10);
        return () => clearTimeout(tid);
      }
    } else {
      setExpand(false);
    }
  }, [isOpen, setExpand]);

  // X button: same slide-down animation as drag dismiss — locks current height,
  // animates translateY(100%), then calls parentOnClose after the slide finishes.
  const onClose = useCallback(() => {
    animateDismiss(panelRef.current, snapTimerRef, parentOnClose);
  }, [parentOnClose]);

  // Drag dismiss: lock current height then slide off — prevents CSS height snap.
  const onDismiss = useCallback(() => {
    animateDismiss(panelRef.current, snapTimerRef, parentOnClose);
  }, [parentOnClose]);

  const drag = useDrag(panelRef, bodyRef, {
    onDismiss,
    onExpand:     () => { setExpand(true);  setBackdrop(1, true); },
    onCollapse:   () => { setExpand(false); setBackdrop(PARTIAL_RATIO / MAX_RATIO, true); },
    isExpandedRef,
    snapTimerRef,
    onVisRatio:   (r) => setBackdrop(r),
  });

  const panelStyle: React.CSSProperties = {
    width:         "100%",
    maxHeight:     `${MAX_RATIO * 100}dvh`,
    height:        expanded ? `${MAX_RATIO * 100}dvh` : `${PARTIAL_RATIO * 100}dvh`,
    display:       "flex",
    flexDirection: "column",
    borderRadius:  expanded ? "12px 12px 0 0" : "16px 16px 0 0",
    background:    "var(--modal-bg)",
    boxShadow:     "0 -8px 40px rgba(0,0,0,0.3)",
    border:        "1px solid var(--fi-border)",
    borderBottom:  "none",
    overflow:      "hidden",
    willChange:    "transform, height",
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" style={{ position: "relative", zIndex }} onClose={closeOnBackdrop ? onClose : () => {}}>
        <Backdrop ref={backdropRef} />
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end" }}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300" enterFrom="translate-y-full" enterTo="translate-y-0"
            leave="ease-in duration-300" leaveFrom="translate-y-0"   leaveTo="translate-y-full"
          >
            <DialogPanel ref={panelRef} style={panelStyle}>

              {/* Drag zone: pill + full header bar */}
              <div
                {...drag.zone}
                style={{ flexShrink: 0, touchAction: "none", userSelect: "none", cursor: "grab" }}
              >
                <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--fi-border)" }} />
                </div>
                <ModalHeader title={title} subtitle={subtitle} headerExtra={headerExtra} onClose={onClose} />
              </div>

              {/* Scroll body: drag activates at scroll boundaries */}
              <div
                ref={bodyRef}
                {...drag.body}
                className="sc-scrollbar"
                style={{
                  flex:               1,
                  overflowY:          "auto",
                  overflowX:          "hidden",
                  padding:            10,
                  background:         "var(--modal-bg)",
                  overscrollBehavior: "contain",
                }}
              >
                {children}
              </div>

              {footer && <ModalFooter footer={footer} />}

            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

// ── CleanModal — auto-picks desktop ↔ mobile ───────────────────────────────

export const CleanModal: React.FC<CleanModalProps> = (props) => {
  const { isMobile } = useDevice();
  const { mode = "auto" } = props;
  if (mode === "modal") return <DesktopModal {...props} />;
  if (mode === "sheet") return <BottomSheet {...props} />;
  return isMobile ? <BottomSheet {...props} /> : <DesktopModal {...props} />;
};

export default CleanModal;
