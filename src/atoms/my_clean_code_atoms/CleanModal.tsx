import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogPanel, DialogTitle,
  Transition, TransitionChild,
} from "@headlessui/react";
import { Drawer } from "vaul";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useDevice } from "../../hooks/useDevice";
import { AnimatedContent } from "../reactbits";

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
  /** Desktop: show expand/collapse icon. Mobile sheet: open at ~65% with swipe-up to full height (default: true) */
  expandable?:      boolean;
  /** "auto" (default) = mobile→sheet, desktop→modal  |  "modal" = always centered  |  "sheet" = always bottom sheet */
  mode?:            "auto" | "modal" | "sheet";
}

// ── Sheet constants ────────────────────────────────────────────────────────

const SHEET_MAX_H    = "97dvh";
const PARTIAL_SNAP   = 0.68;              // ≈ 65dvh of the sheet visible
const FULL_SNAP      = 1;
const SNAP_POINTS    = [PARTIAL_SNAP, FULL_SNAP];
const VAUL_MS        = 500;               // matches vaul's internal transition
const VAUL_EASE      = "cubic-bezier(0.32,0.72,0,1)";
const POPUP_SELECTOR = "[data-portal-popup]";

// Height of the sheet hidden below the viewport at the partial snap point.
// Mirrors vaul's own offset maths (fraction of window.innerHeight).
const partialHiddenPx = () => window.innerHeight * (1 - PARTIAL_SNAP);

const isPortalPopup = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest(POPUP_SELECTOR);

function readTranslateY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  return !t || t === "none" ? 0 : new DOMMatrixReadOnly(t).m42;
}

const srOnly: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
};

// ── Simple backdrop for desktop ────────────────────────────────────────────

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
  width: 28, height: 28, borderRadius: "var(--radius)", border: "none",
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
  /** HeadlessUI DialogTitle on desktop, vaul Drawer.Title in the sheet */
  TitleTag?: React.ElementType;
}> = ({ title, subtitle, headerExtra, expandControl, onClose, TitleTag = DialogTitle }) => {
  if (!title && !headerExtra) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--fi-border)", background: "transparent" }}>
      <div style={{ minWidth: 0 }}>
        {title && <TitleTag style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--fi-text)", lineHeight: 1.3 }}>{title}</TitleTag>}
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
  <div className="sc-scrollbar" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "transparent" }}>
    {children}
  </div>
);

const ModalFooter = React.forwardRef<HTMLDivElement, { footer: React.ReactNode; style?: React.CSSProperties }>(
  ({ footer, style }, ref) => (
    <div ref={ref} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderTop: "1px solid var(--fi-border)", flexShrink: 0, background: "var(--modal-bg)", ...style }}>
      {footer}
    </div>
  ),
);
ModalFooter.displayName = "ModalFooter";

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
                borderRadius:  expanded ? 0 : "var(--radius)",
                // Dark: Proton teal-glow gradient · Light: plain --modal-bg
                background:    "var(--modal-panel-bg, var(--modal-bg))",
                boxShadow:     "0 20px 60px rgba(0,0,0,0.2)",
                overflow:      "hidden",
                border:        "1px solid var(--modal-border, var(--fi-border))",
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

// ── Mobile bottom sheet (vaul) ─────────────────────────────────────────────
// vaul owns the drag physics, velocity-based flicks, snap points, the
// scroll ↔ drag hand-off and keyboard repositioning (Instagram/YouTube feel).
// Expandable sheets open at PARTIAL_SNAP, swipe up → full height, swipe down
// from the lowest point → dismiss.

// Keeps the footer pinned to the visible bottom edge while the sheet sits
// between snap points (the lower part of the sheet is off-screen there),
// and lets it travel with the sheet once dragged below the partial point.
function useStickyFooter(
  active:     boolean,
  contentRef: React.RefObject<HTMLDivElement | null>,
  footerRef:  React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const el = contentRef.current;
      const f  = footerRef.current;
      if (el && f) {
        const lift = Math.min(Math.max(readTranslateY(el), 0), partialHiddenPx());
        f.style.transform = `translate3d(0, ${-lift}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, contentRef, footerRef]);
}

const BottomSheet: React.FC<CleanModalProps> = ({
  isOpen, onClose, title, subtitle, children, footer,
  closeOnBackdrop = false, headerExtra, zIndex = 9999, expandable = true,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const footerRef  = useRef<HTMLDivElement>(null);
  const isOpenRef  = useRef(isOpen);
  isOpenRef.current = isOpen;

  const [snap, setSnap] = useState<number | string | null>(PARTIAL_SNAP);

  useEffect(() => { if (isOpen) setSnap(PARTIAL_SNAP); }, [isOpen]);

  useStickyFooter(isOpen && expandable && !!footer, contentRef, footerRef);

  // The parent may veto a swipe-dismiss (e.g. an unsaved-changes guard keeps
  // isOpen=true). vaul has already slid the panel away by then, so glide it
  // back to the partial point ourselves.
  const restoreAfterVeto = useCallback(() => {
    const el = contentRef.current;
    if (el) {
      el.style.transition = `transform ${VAUL_MS}ms ${VAUL_EASE}`;
      el.style.transform  = `translate3d(0, ${expandable ? partialHiddenPx() : 0}px, 0)`;
    }
    const ov = overlayRef.current;
    if (ov) {
      ov.style.transition = `opacity ${VAUL_MS}ms ${VAUL_EASE}`;
      ov.style.opacity    = "1";
    }
    setSnap(PARTIAL_SNAP);
  }, [expandable]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) return;
    onClose();
    setTimeout(() => { if (isOpenRef.current) restoreAfterVeto(); }, 0);
  }, [onClose, restoreAfterVeto]);

  const snapProps = expandable
    ? { snapPoints: SNAP_POINTS, fadeFromIndex: 0, activeSnapPoint: snap, setActiveSnapPoint: setSnap }
    : {};

  const atPartial = expandable && snap !== FULL_SNAP;
  const hasHeader = !!(title || headerExtra);

  return (
    <Drawer.Root open={isOpen} onOpenChange={handleOpenChange} {...snapProps}>
      <Drawer.Portal>
        <Drawer.Overlay
          ref={overlayRef}
          style={{
            position:             "fixed",
            inset:                0,
            zIndex,
            background:           "rgba(0,0,0,0.45)",
            backdropFilter:       "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
        <Drawer.Content
          ref={contentRef}
          aria-describedby={undefined}
          // Taps on portaled dropdown / date-picker popups must not dismiss the sheet
          onInteractOutside={e => { if (!closeOnBackdrop || isPortalPopup(e.target)) e.preventDefault(); }}
          style={{
            position:      "fixed",
            left:          0,
            right:         0,
            bottom:        0,
            zIndex,
            height:        expandable ? SHEET_MAX_H : "auto",
            maxHeight:     SHEET_MAX_H,
            display:       "flex",
            flexDirection: "column",
            borderRadius:  "16px 16px 0 0",
            background:    "var(--modal-panel-bg, var(--modal-bg))",
            border:        "1px solid var(--modal-border, var(--fi-border))",
            borderBottom:  "none",
            boxShadow:     "0 -8px 40px rgba(0,0,0,0.3)",
            outline:       "none",
          }}
        >
          {/* Grab handle + header — tap the handle to toggle partial ↔ full */}
          <div style={{ flexShrink: 0, borderRadius: "16px 16px 0 0", background: "transparent" }}>
            <div style={{ padding: "8px 0 4px" }}>
              <Drawer.Handle style={{ width: 36, height: 4, background: "var(--fi-border)", opacity: 1 }} />
            </div>
            {hasHeader
              ? <ModalHeader title={title} subtitle={subtitle} headerExtra={headerExtra} onClose={() => handleOpenChange(false)} TitleTag={Drawer.Title} />
              : <Drawer.Title style={srOnly}>Dialog</Drawer.Title>}
          </div>

          {/* Scrollable body — vaul drags the sheet when scrolled to the top */}
          <div
            className="sc-scrollbar"
            style={{
              flex:               "1 1 auto",
              minHeight:          0,
              overflowY:          "auto",
              overflowX:          "hidden",
              padding:            10,
              paddingBottom:      atPartial && footer ? 10 + partialHiddenPx() : 10,
              background:         "transparent",
              overscrollBehavior: "contain",
            }}
          >
            <AnimatedContent distance={18} delay={0.08}>{children}</AnimatedContent>
          </div>

          {footer && (
            <ModalFooter
              ref={footerRef}
              footer={footer}
              style={{ padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", willChange: "transform" }}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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
