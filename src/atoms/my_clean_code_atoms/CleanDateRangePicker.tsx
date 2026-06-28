import React from "react";
import { CleanDatePicker } from "./CleanDatePicker";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CleanDateRangePickerProps {
  label?:        string;
  fromValue?:    string;
  toValue?:      string;
  onFromChange?: (value: string) => void;
  onToChange?:   (value: string) => void;
  fromLabel?:    string;
  toLabel?:      string;
  clearable?:    boolean;
  onClear?:      () => void;
  /** Stack pickers vertically — useful inside narrow containers (default: false) */
  stacked?:      boolean;
  style?:        React.CSSProperties;
}

// ── Component ──────────────────────────────────────────────────────────────

export const CleanDateRangePicker: React.FC<CleanDateRangePickerProps> = ({
  label      = "Date Range",
  fromValue  = "",
  toValue    = "",
  onFromChange,
  onToChange,
  fromLabel  = "From",
  toLabel    = "To",
  clearable  = true,
  onClear,
  stacked    = false,
  style,
}) => {
  const hasValue = !!(fromValue || toValue);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 16 }}>
        {label && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fi-label)", userSelect: "none" }}>
            {label}
          </span>
        )}
        {clearable && hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 11, color: "var(--fi-muted)", background: "none", border: "none",
              cursor: "pointer", padding: 0, lineHeight: 1, textDecoration: "underline",
              transition: "color 120ms ease",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--fi-text)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--fi-muted)"}
          >
            Clear
          </button>
        )}
      </div>

      {/* Pickers */}
      <div style={{
        display:       "flex",
        flexDirection: stacked ? "column" : "row",
        gap:           stacked ? 8 : 6,
        alignItems:    stacked ? "stretch" : "flex-end",
      }}>

        {/* From */}
        <CleanDatePicker
          label={fromLabel}
          value={fromValue}
          onChange={v => onFromChange?.(v)}
          max={toValue || undefined}
          clearable={clearable}
          style={{ flex: 1 }}
        />

        {/* Separator (row layout only) */}
        {!stacked && (
          <span style={{ fontSize: 14, color: "var(--fi-muted)", paddingBottom: 6, flexShrink: 0 }}>—</span>
        )}

        {/* To */}
        <CleanDatePicker
          label={toLabel}
          value={toValue}
          onChange={v => onToChange?.(v)}
          min={fromValue || undefined}
          clearable={clearable}
          style={{ flex: 1 }}
        />

      </div>
    </div>
  );
};

export default CleanDateRangePicker;
