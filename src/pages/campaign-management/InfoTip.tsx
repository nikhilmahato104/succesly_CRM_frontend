import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { MEANINGS, type MeaningKey } from "./meanings";

const POPOVER_WIDTH = 260;
const GUTTER        = 12;

/**
 * Eye icon that shows what a label means. Click to open, click again / outside /
 * scroll / Esc to close. The popover is portalled and clamped to the viewport so
 * it never runs off-screen on a phone.
 */
export const InfoTip: React.FC<{ k: MeaningKey; size?: number }> = ({ k, size = 13 }) => {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - GUTTER * 2);
    const left  = Math.min(Math.max(GUTTER, r.left + r.width / 2 - width / 2), window.innerWidth - width - GUTTER);
    const popH  = popRef.current?.offsetHeight ?? 90;
    // Flip above when there is no room below (e.g. just above the mobile bottom bar)
    const above = r.bottom + popH + 8 > window.innerHeight - 72 && r.top > popH + 8;
    setPos({ top: above ? r.top - popH - 6 : r.bottom + 6, left, above });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const Icon = open ? EyeOff : Eye;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="no-min-tap"
        aria-label="What does this mean?"
        aria-expanded={open}
        title="What does this mean?"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size + 10, height: size + 10, padding: 0, margin: "-5px 0",
          border: "none", borderRadius: 99, background: open ? "rgba(99,102,241,0.14)" : "transparent",
          color: open ? "#6366f1" : "var(--fi-muted)", cursor: "pointer", verticalAlign: "middle",
          textTransform: "none", letterSpacing: 0, flexShrink: 0,
        }}
      >
        <Icon style={{ width: size, height: size }} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="tooltip"
          data-portal-popup="true"
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 100000,
            width: Math.min(POPOVER_WIDTH, window.innerWidth - GUTTER * 2),
            padding: "10px 12px", borderRadius: 8,
            background: "var(--fi-bg-panel, var(--sc-card))", color: "var(--dt-text)",
            border: "1px solid var(--fi-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            fontSize: 12, lineHeight: 1.5, fontWeight: 400,
            textTransform: "none", letterSpacing: 0, whiteSpace: "normal", textAlign: "left",
          }}
        >
          {MEANINGS[k]}
        </div>,
        document.body,
      )}
    </>
  );
};

/** Label text followed by the eye icon */
export const LabelWithTip: React.FC<{ k: MeaningKey; children: React.ReactNode }> = ({ k, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    {children}
    <InfoTip k={k} />
  </span>
);

export default InfoTip;
