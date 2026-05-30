import React from "react";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export type ButtonSize    = "xs" | "sm" | "md" | "lg";

export interface CleanButtonProps {
  variant?:      ButtonVariant;
  size?:         ButtonSize;
  icon?:         React.ReactNode;   // icon only — renders without label padding
  iconLeft?:     React.ReactNode;   // icon on the left of label
  iconRight?:    React.ReactNode;   // icon on the right of label
  loading?:      boolean;
  disabled?:     boolean;
  type?:         "button" | "submit" | "reset";
  form?:         string;
  onClick?:      (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?:     React.ReactNode;
  style?:        React.CSSProperties;
  title?:        string;
  badge?:        number | string;   // small count badge (e.g. filter count)
}

// ── Size tokens ────────────────────────────────────────────────────────────────
const SIZE: Record<ButtonSize, { height: number; px: number; fontSize: number; gap: number; iconSize: number }> = {
  xs: { height: 26, px: 8,  fontSize: 11, gap: 4, iconSize: 12 },
  sm: { height: 30, px: 10, fontSize: 12, gap: 5, iconSize: 13 },
  md: { height: 34, px: 14, fontSize: 13, gap: 6, iconSize: 14 },
  lg: { height: 38, px: 18, fontSize: 14, gap: 7, iconSize: 15 },
};

// ── Variant styles ─────────────────────────────────────────────────────────────
const VARIANT_BASE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background:  "var(--btn-primary-bg)",
    color:       "var(--btn-primary-text)",
    border:      "1px solid transparent",
  },
  outline: {
    background:  "var(--fi-bg)",
    color:       "var(--fi-text)",
    border:      "1px solid var(--fi-border)",
  },
  ghost: {
    background:  "transparent",
    color:       "var(--fi-label)",
    border:      "1px solid transparent",
  },
  danger: {
    background:  "transparent",
    color:       "#ef4444",
    border:      "1px solid rgba(239,68,68,0.35)",
  },
};

const VARIANT_HOVER: Record<ButtonVariant, Partial<React.CSSProperties>> = {
  primary: { background: "var(--btn-primary-hover)" },
  outline: { background: "var(--sb-hover)", borderColor: "var(--fi-border-focus)" },
  ghost:   { background: "var(--sb-hover)", color: "var(--fi-text)" },
  danger:  { background: "rgba(239,68,68,0.08)" },
};

// ── Component ──────────────────────────────────────────────────────────────────
export const CleanButton: React.FC<CleanButtonProps> = ({
  variant  = "outline",
  size     = "sm",
  icon,
  iconLeft,
  iconRight,
  loading  = false,
  disabled = false,
  type     = "button",
  form,
  onClick,
  children,
  style,
  title,
  badge,
}) => {
  const sz = SIZE[size];
  const isDisabled = disabled || loading;
  const isIconOnly = !!icon && !children;

  const baseStyle: React.CSSProperties = {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            sz.gap,
    height:         sz.height,
    padding:        isIconOnly ? `0 ${sz.px * 0.7}px` : `0 ${sz.px}px`,
    borderRadius:   "var(--fi-radius)",
    fontSize:       sz.fontSize,
    fontWeight:     500,
    lineHeight:     1,
    cursor:         isDisabled ? "not-allowed" : "pointer",
    opacity:        isDisabled ? 0.5 : 1,
    transition:     "background 140ms ease, border-color 140ms ease, color 140ms ease",
    whiteSpace:     "nowrap",
    userSelect:     "none",
    boxSizing:      "border-box",
    ...VARIANT_BASE[variant],
    ...style,
  };

  const handleHover = (enter: boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const el = e.currentTarget;
    const h = VARIANT_HOVER[variant];
    if (enter) {
      Object.entries(h).forEach(([k, v]) => ((el.style as any)[k] = v));
    } else {
      const base = VARIANT_BASE[variant];
      Object.keys(h).forEach((k) => ((el.style as any)[k] = (base as any)[k] ?? ""));
    }
  };

  return (
    <button
      type={type}
      form={form}
      style={baseStyle}
      disabled={isDisabled}
      onClick={onClick}
      title={title}
      onMouseEnter={handleHover(true)}
      onMouseLeave={handleHover(false)}
    >
      {loading ? (
        <span style={{ width: sz.iconSize, height: sz.iconSize, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
      ) : (
        <>
          {icon   && <span style={{ display: "flex", width: sz.iconSize, height: sz.iconSize }}>{icon}</span>}
          {iconLeft && <span style={{ display: "flex", width: sz.iconSize, height: sz.iconSize }}>{iconLeft}</span>}
          {children}
          {iconRight && <span style={{ display: "flex", width: sz.iconSize, height: sz.iconSize }}>{iconRight}</span>}
          {badge !== undefined && (
            <span style={{
              minWidth: 16, height: 16, borderRadius: 8, fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              background: "var(--sb-text-active)", color: "var(--sb-bg)",
            }}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default CleanButton;
