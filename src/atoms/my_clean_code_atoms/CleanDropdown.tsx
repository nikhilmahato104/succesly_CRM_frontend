import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CleanDropdownProps {
  label?:       string;
  value?:       string;
  options:      DropdownOption[];
  onChange?:    (value: string) => void;
  placeholder?: string;
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
  required?:    boolean;
  clearable?:   boolean;
  style?:       React.CSSProperties;
  name?:        string;
  id?:          string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface ListRect { top: number; left: number; width: number; above: boolean; triggerBottom: number; }

const OPTION_LIST_MAX_H = 224;

function calcListRect(triggerEl: HTMLDivElement): ListRect {
  const rect       = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 4;
  const spaceAbove = rect.top - 4;
  const above      = spaceBelow < Math.min(OPTION_LIST_MAX_H, 100) && spaceAbove > spaceBelow;
  return {
    top:           rect.bottom + 4,
    left:          rect.left,
    width:         rect.width,
    above,
    triggerBottom: rect.top,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export const CleanDropdown: React.FC<CleanDropdownProps> = ({
  label,
  value = "",
  options,
  onChange,
  placeholder,
  error,
  hint,
  disabled  = false,
  required  = false,
  clearable = false,
  style,
  name,
  id,
}) => {
  const [open,    setOpen]    = useState(false);
  const [listRect, setListRect] = useState<ListRect>({ top: 0, left: 0, width: 0, above: false, triggerBottom: 0 });

  const triggerRef  = useRef<HTMLDivElement>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const generatedId = useRef(`cd-${Math.random().toString(36).slice(2, 8)}`);
  const resolvedId  = id ?? generatedId.current;

  const selected = options.find(o => o.value === value);
  const hasValue = !!value;

  // Recalculate portal position when opening
  useLayoutEffect(() => {
    if (open && triggerRef.current) setListRect(calcListRect(triggerRef.current));
  }, [open]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (triggerRef.current) setListRect(calcListRect(triggerRef.current));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Close on outside click (checks both trigger and portal list)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insideList    = listRef.current?.contains(target);
      if (!insideTrigger && !insideList) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = useCallback(() => { if (!disabled) setOpen(v => !v); }, [disabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") setOpen(false);
  }, [disabled, toggle]);

  const handleSelect = useCallback((opt: DropdownOption) => {
    if (opt.disabled) return;
    onChange?.(opt.value);
    setOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
  }, [onChange]);

  // ── Styles ─────────────────────────────────────────────────────────────

  const triggerStyle: React.CSSProperties = {
    width:        "100%",
    height:       "var(--fi-height)",
    padding:      "0 36px 0 10px",
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
  };

  const listStyle: React.CSSProperties = {
    position:     "fixed",
    top:          listRect.above ? "auto" : listRect.top,
    bottom:       listRect.above ? (window.innerHeight - listRect.triggerBottom + 4) : "auto",
    left:         listRect.left,
    width:        listRect.width,
    zIndex:       10001,
    background:   "var(--fi-bg-panel)",
    border:       `1px solid var(--fi-border-focus)`,
    borderRadius: "var(--fi-radius)",
    boxShadow:    "0 8px 24px rgba(0,0,0,0.14)",
    maxHeight:    OPTION_LIST_MAX_H,
    overflowY:    "auto",
    padding:      "4px 0",
  };

  // ── Option item helpers ────────────────────────────────────────────────

  const optionStyle = (opt: DropdownOption): React.CSSProperties => ({
    padding:     "8px 10px",
    fontSize:    "var(--fi-font-size)",
    color:       opt.disabled ? "var(--fi-muted)" : opt.value === value ? "var(--primary)" : "var(--fi-text)",
    cursor:      opt.disabled ? "not-allowed" : "pointer",
    background:  opt.value === value ? "var(--primary-light)" : "transparent",
    fontWeight:  opt.value === value ? 500 : 400,
    opacity:     opt.disabled ? 0.5 : 1,
    transition:  "background 100ms ease",
    display:     "flex",
    alignItems:  "center",
    justifyContent: "space-between",
    userSelect:  "none",
  });

  // ── Portal list ────────────────────────────────────────────────────────

  const portalList = open && createPortal(
    <div
      ref={listRef}
      id={`${resolvedId}-listbox`}
      role="listbox"
      aria-labelledby={`${resolvedId}-label`}
      className="sc-scrollbar"
      data-portal-popup="true"
      style={listStyle}
    >
      {placeholder && (
        <div
          role="option"
          aria-selected={!hasValue}
          onClick={() => { onChange?.(""); setOpen(false); }}
          style={{
            padding:    "8px 10px",
            fontSize:   "var(--fi-font-size)",
            color:      "var(--fi-muted)",
            cursor:     "pointer",
            fontStyle:  "italic",
            background: !hasValue ? "var(--primary-light)" : "transparent",
            transition: "background 100ms ease",
            userSelect: "none",
          }}
          onMouseEnter={e => { if (hasValue) (e.currentTarget as HTMLElement).style.background = "var(--sb-hover)"; }}
          onMouseLeave={e => { if (hasValue) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {placeholder}
        </div>
      )}
      {options.map(opt => (
        <div
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          aria-disabled={opt.disabled}
          onClick={() => handleSelect(opt)}
          style={optionStyle(opt)}
          onMouseEnter={e => {
            if (!opt.disabled && opt.value !== value)
              (e.currentTarget as HTMLElement).style.background = "var(--sb-hover)";
          }}
          onMouseLeave={e => {
            if (!opt.disabled && opt.value !== value)
              (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {opt.label}
          {opt.value === value && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label
          id={`${resolvedId}-label`}
          htmlFor={resolvedId}
          style={{ fontSize: 12, fontWeight: 500, color: "var(--fi-label)", userSelect: "none" }}
        >
          {label}
          {required && <span style={{ color: "var(--fi-border-error)", marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        {/* Trigger */}
        <div
          ref={triggerRef}
          id={resolvedId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${resolvedId}-listbox`}
          aria-labelledby={label ? `${resolvedId}-label` : undefined}
          tabIndex={disabled ? -1 : 0}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          style={triggerStyle}
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hasValue ? selected?.label : (placeholder ?? "Select…")}
          </span>
        </div>

        {/* Clear + chevron overlay */}
        <span style={{
          position:      "absolute",
          right:         8,
          top:           "50%",
          transform:     "translateY(-50%)",
          display:       "flex",
          alignItems:    "center",
          gap:           4,
          pointerEvents: "none",
        }}>
          {clearable && hasValue && (
            <span
              role="button"
              aria-label="Clear selection"
              onClick={handleClear}
              style={{
                display:       "flex",
                alignItems:    "center",
                cursor:        "pointer",
                pointerEvents: "all",
                color:         "var(--fi-muted)",
                padding:       2,
                borderRadius:  3,
                transition:    "color 120ms ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--fi-text)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--fi-muted)"}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <span style={{
            color:      "var(--fi-muted)",
            display:    "flex",
            alignItems: "center",
            transition: "transform 200ms cubic-bezier(0.4,0,0.2,1)",
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </div>

      {/* Portal-rendered options list — escapes any overflow clipping context */}
      {portalList}

      {/* Validation messages */}
      {error    && <span style={{ fontSize: 11, color: "var(--fi-border-error)" }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: 11, color: "var(--fi-muted)" }}>{hint}</span>}

      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
};

export default CleanDropdown;
