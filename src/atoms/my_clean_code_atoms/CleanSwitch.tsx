import React from "react";
import { Loader2 } from "lucide-react";

export interface CleanSwitchProps {
  checked:    boolean;
  onChange:   (next: boolean) => void;
  label?:     React.ReactNode;
  hint?:      React.ReactNode;
  disabled?:  boolean;
  loading?:   boolean;
  /** Track colour when on — defaults to the primary colour */
  onColor?:   string;
  size?:      "sm" | "md";
  ariaLabel?: string;
}

const SIZES = {
  sm: { w: 32, h: 18, knob: 14 },
  md: { w: 40, h: 22, knob: 18 },
};

export const CleanSwitch: React.FC<CleanSwitchProps> = ({
  checked, onChange, label, hint, disabled = false, loading = false,
  onColor = "var(--primary)", size = "md", ariaLabel,
}) => {
  const { w, h, knob } = SIZES[size];
  const inactive = disabled || loading;

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={inactive}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        position:     "relative",
        width:        w,
        height:       h,
        flexShrink:   0,
        borderRadius: 99,
        border:       "none",
        padding:      0,
        cursor:       inactive ? "not-allowed" : "pointer",
        background:   checked ? onColor : "var(--fi-border)",
        opacity:      disabled ? 0.5 : 1,
        transition:   "background 160ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        position:       "absolute",
        top:            (h - knob) / 2,
        left:           checked ? w - knob - (h - knob) / 2 : (h - knob) / 2,
        width:          knob,
        height:         knob,
        borderRadius:   "50%",
        background:     "#ffffff",
        boxShadow:      "0 1px 3px rgba(0,0,0,0.3)",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        transition:     "left 160ms ease",
      }}>
        {loading && <Loader2 className="animate-spin" style={{ width: knob - 6, height: knob - 6, color: "#6b7280" }} />}
      </span>
    </button>
  );

  if (!label && !hint) return track;

  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: inactive ? "not-allowed" : "pointer" }}>
      {track}
      <span style={{ minWidth: 0 }}>
        {label && <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--fi-text)", lineHeight: `${h}px` }}>{label}</span>}
        {hint  && <span style={{ display: "block", fontSize: 12, color: "var(--fi-muted)", marginTop: 2, lineHeight: 1.4 }}>{hint}</span>}
      </span>
    </label>
  );
};

export default CleanSwitch;
