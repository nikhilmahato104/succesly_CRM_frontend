import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CleanDatePickerProps {
  value?:       string;            // YYYY-MM-DD
  onChange?:    (value: string) => void;
  label?:       string;
  placeholder?: string;
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
  required?:    boolean;
  clearable?:   boolean;
  min?:         string;            // YYYY-MM-DD
  max?:         string;            // YYYY-MM-DD
  style?:       React.CSSProperties;
  id?:          string;
}

// ── Calendar helpers ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalCell { year: number; month: number; day: number; current: boolean; }

function buildCells(year: number, month: number): CalCell[] {
  const firstDow   = new Date(year, month, 1).getDay();
  const daysInMon  = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalCell[] = [];

  for (let i = firstDow - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ year: py, month: pm, day: daysInPrev - i, current: false });
  }
  for (let d = 1; d <= daysInMon; d++) {
    cells.push({ year, month, day: d, current: true });
  }
  let nd = 1;
  while (cells.length < 42) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ year: ny, month: nm, day: nd++, current: false });
  }
  return cells;
}

function cellToYMD(c: CalCell): string {
  return `${c.year}-${String(c.month + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

function parseYMD(s: string | undefined): { year: number; month: number; day: number } | null {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatDisplay(ymd: string | undefined): string {
  if (!ymd) return "";
  const p = parseYMD(ymd);
  if (!p) return ymd;
  const d = new Date(p.year, p.month, p.day);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function compareYMD(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ── Portal positioning ─────────────────────────────────────────────────────

interface CalRect { top: number; left: number; above: boolean; triggerTop: number; }
const CAL_HEIGHT = 310;

function calcCalRect(el: HTMLDivElement): CalRect {
  const r        = el.getBoundingClientRect();
  const below    = window.innerHeight - r.bottom - 6;
  const above    = r.top - 6;
  const showAbove = below < CAL_HEIGHT && above > below;
  return { top: r.bottom + 4, left: r.left, above: showAbove, triggerTop: r.top };
}

// ── Component ──────────────────────────────────────────────────────────────

export const CleanDatePicker: React.FC<CleanDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = "Select date",
  error,
  hint,
  disabled  = false,
  required  = false,
  clearable = false,
  min,
  max,
  style,
  id,
}) => {
  const today      = new Date();
  const todayYMD   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const selectedParsed = parseYMD(value);
  const initYear  = selectedParsed?.year  ?? today.getFullYear();
  const initMonth = selectedParsed?.month ?? today.getMonth();

  const [open,       setOpen]       = useState(false);
  const [viewYear,   setViewYear]   = useState(initYear);
  const [viewMonth,  setViewMonth]  = useState(initMonth);
  const [calRect,    setCalRect]    = useState<CalRect>({ top: 0, left: 0, above: false, triggerTop: 0 });
  const [animIn,     setAnimIn]     = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const calRef     = useRef<HTMLDivElement>(null);
  const genId      = useRef(`cdp-${Math.random().toString(36).slice(2, 8)}`);
  const resolvedId = id ?? genId.current;

  // Sync view to selected value when it changes externally
  useEffect(() => {
    if (value && !open) {
      const p = parseYMD(value);
      if (p) { setViewYear(p.year); setViewMonth(p.month); }
    }
  }, [value, open]);

  // Calculate portal position on open
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setCalRect(calcCalRect(triggerRef.current));
      requestAnimationFrame(() => setAnimIn(true));
    } else {
      setAnimIn(false);
    }
  }, [open]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    const update = () => { if (triggerRef.current) setCalRect(calcCalRect(triggerRef.current)); };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !calRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const doOpen = useCallback(() => {
    if (disabled) return;
    const p = parseYMD(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
    else   { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }
    setOpen(true);
  }, [disabled, value, today]);

  const doClose = useCallback(() => { setAnimIn(false); setTimeout(() => setOpen(false), 160); }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open ? doClose() : doOpen(); }
    if (e.key === "Escape") doClose();
  }, [disabled, open, doOpen, doClose]);

  const prevMonth = () => {
    setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  };
  const nextMonth = () => {
    setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
  };

  const handleSelectDay = (cell: CalCell) => {
    const ymd = cellToYMD(cell);
    if (min && compareYMD(ymd, min) < 0) return;
    if (max && compareYMD(ymd, max) > 0) return;
    onChange?.(ymd);
    doClose();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
  };

  const cells    = buildCells(viewYear, viewMonth);
  const hasValue = !!value;

  // ── Styles ─────────────────────────────────────────────────────────────

  const triggerStyle: React.CSSProperties = {
    width:        "100%",
    height:       "var(--fi-height)",
    padding:      "0 36px 0 34px",
    background:   "var(--fi-bg)",
    border:       `1px solid ${error ? "var(--fi-border-error)" : open ? "var(--fi-border-focus)" : "var(--fi-border)"}`,
    borderRadius: "var(--fi-radius)",
    boxShadow:    open && !error ? "var(--fi-shadow-focus)" : "none",
    fontSize:     "var(--fi-font-size)",
    color:        hasValue ? "var(--fi-text)" : "var(--fi-muted)",
    transition:   "border-color 140ms ease, box-shadow 140ms ease",
    opacity:      disabled ? 0.5 : 1,
    cursor:       disabled ? "not-allowed" : "pointer",
    display:      "flex",
    alignItems:   "center",
    userSelect:   "none",
    boxSizing:    "border-box",
    outline:      "none",
    whiteSpace:   "nowrap",
    overflow:     "hidden",
    textOverflow: "ellipsis",
  };

  const calStyle: React.CSSProperties = {
    position:     "fixed",
    top:          calRect.above ? "auto" : calRect.top,
    bottom:       calRect.above ? window.innerHeight - calRect.triggerTop + 4 : "auto",
    left:         calRect.left,
    width:        280,
    zIndex:       10002,
    background:   "var(--fi-bg-panel)",
    border:       "1px solid var(--fi-border)",
    borderRadius: "var(--fi-radius)",
    boxShadow:    "0 8px 32px rgba(0,0,0,0.16)",
    padding:      "12px 10px 10px",
    opacity:      animIn ? 1 : 0,
    transform:    animIn ? "scale(1) translateY(0)" : "scale(0.96) translateY(-4px)",
    transition:   "opacity 160ms ease, transform 160ms cubic-bezier(0.4,0,0.2,1)",
    transformOrigin: calRect.above ? "bottom center" : "top center",
  };

  const navBtnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: "1px solid var(--fi-border)",
    background: "var(--fi-bg)", color: "var(--fi-text)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, transition: "background 120ms ease", userSelect: "none",
  };

  // ── Calendar portal ────────────────────────────────────────────────────

  const calPortal = open && createPortal(
    <div
      ref={calRef}
      data-portal-popup="true"
      style={calStyle}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Month / year navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button
          type="button" style={navBtnStyle} onClick={prevMonth}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--fi-bg)")}
        >
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fi-text)", userSelect: "none" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button" style={navBtnStyle} onClick={nextMonth}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--sb-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--fi-bg)")}
        >
          ›
        </button>
      </div>

      {/* Day-of-week header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--fi-muted)", padding: "3px 0", userSelect: "none", letterSpacing: "0.04em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((cell, idx) => {
          const ymd        = cellToYMD(cell);
          const isSelected = ymd === value;
          const isToday    = ymd === todayYMD;
          const disabled   =
            (!!min && compareYMD(ymd, min) < 0) ||
            (!!max && compareYMD(ymd, max) > 0);
          const dimmed     = !cell.current || disabled;

          const cellStyle: React.CSSProperties = {
            height:        34,
            display:       "flex",
            alignItems:    "center",
            justifyContent:"center",
            borderRadius:  6,
            fontSize:      12,
            fontWeight:    isSelected ? 600 : 400,
            cursor:        (disabled || !cell.current) ? (disabled ? "not-allowed" : "default") : "pointer",
            userSelect:    "none",
            transition:    "background 100ms ease, color 100ms ease",
            background:    isSelected ? "var(--primary)" : "transparent",
            color:         isSelected
              ? "var(--primary-text)"
              : dimmed
                ? "var(--fi-muted)"
                : isToday
                  ? "var(--primary)"
                  : "var(--fi-text)",
            opacity:       disabled ? 0.35 : 1,
            position:      "relative",
          };

          return (
            <div
              key={idx}
              style={cellStyle}
              onClick={() => !disabled && cell.current && handleSelectDay(cell)}
              onMouseEnter={e => {
                if (!disabled && cell.current && !isSelected)
                  (e.currentTarget as HTMLElement).style.background = "var(--sb-hover)";
              }}
              onMouseLeave={e => {
                if (!isSelected)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {cell.day}
              {isToday && !isSelected && (
                <span style={{
                  position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%", background: "var(--primary)",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Today shortcut */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--fi-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => { onChange?.(todayYMD); doClose(); }}
          style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontWeight: 500 }}
        >
          Today
        </button>
        {clearable && hasValue && (
          <button
            type="button"
            onClick={() => { onChange?.(""); doClose(); }}
            style={{ fontSize: 11, color: "var(--fi-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label
          htmlFor={resolvedId}
          style={{ fontSize: 12, fontWeight: 500, color: "var(--fi-label)", userSelect: "none" }}
        >
          {label}
          {required && <span style={{ color: "var(--fi-border-error)", marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        {/* Calendar icon */}
        <span style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--fi-muted)", display: "flex", alignItems: "center", pointerEvents: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>

        {/* Trigger */}
        <div
          ref={triggerRef}
          id={resolvedId}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => open ? doClose() : doOpen()}
          onKeyDown={handleKeyDown}
          style={triggerStyle}
        >
          {hasValue ? formatDisplay(value) : placeholder}
        </div>

        {/* Clear / chevron */}
        <span style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {clearable && hasValue && (
            <span
              onClick={handleClear}
              style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "var(--fi-muted)", pointerEvents: "all", transition: "color 120ms ease" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--fi-text)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--fi-muted)"}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span style={{ color: "var(--fi-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", pointerEvents: "none" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </div>

      {calPortal}

      {error    && <span style={{ fontSize: 11, color: "var(--fi-border-error)" }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: 11, color: "var(--fi-muted)" }}>{hint}</span>}
    </div>
  );
};

export default CleanDatePicker;
