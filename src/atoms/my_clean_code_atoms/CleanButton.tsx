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
  active?:       boolean;  // keeps focus-border without hover
  type?:         "button" | "submit" | "reset";
  form?:         string;
  onClick?:      (e: React.MouseEvent<HTMLButtonElement>) => void;
  children?:     React.ReactNode;
  style?:        React.CSSProperties;
  title?:        string;
  badge?:        number | string;   // small count badge (e.g. filter count)
}

// ── Size tokens ────────────────────────────────────────────────────────────────
// Heights reference CSS variables (--btn-h-*) so changing index.css updates
// every button in the platform at once without touching TypeScript.
const SIZE: Record<ButtonSize, { h: string; px: number; fontSize: number; gap: number; iconSize: number }> = {
  xs: { h: "var(--btn-h-xs)", px: 7,  fontSize: 11, gap: 3, iconSize: 11 },
  sm: { h: "var(--btn-h-sm)", px: 9,  fontSize: 12, gap: 4, iconSize: 12 },
  md: { h: "var(--btn-h-md)", px: 12, fontSize: 13, gap: 5, iconSize: 13 },
  lg: { h: "var(--btn-h-lg)", px: 16, fontSize: 14, gap: 6, iconSize: 14 },
};

// ── Variant styles ─────────────────────────────────────────────────────────────
const VARIANT_BASE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background:  "var(--btn-primary-bg)",
    color:       "var(--btn-primary-text)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
  },
  outline: {
    background:  "var(--fi-bg)",
    color:       "var(--fi-text)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--fi-border)",
  },
  ghost: {
    background:  "transparent",
    color:       "var(--fi-label)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
  },
  danger: {
    background:  "transparent",
    color:       "#ef4444",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(239,68,68,0.35)",
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
  active   = false,
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
    height:         sz.h,
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
    // active = panel open → keep focus border without hover
    ...(active && variant === "outline" ? { borderColor: "var(--fi-border-focus)" } : {}),
    ...style,
  };

  const handleHover = (enter: boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const el = e.currentTarget;
    const h  = VARIANT_HOVER[variant];
    if (enter) {
      // when active, only change background — keep the focus border
      Object.entries(h).forEach(([k, v]) => {
        if (active && k === "borderColor") return;
        (el.style as any)[k] = v;
      });
    } else {
      const base = VARIANT_BASE[variant];
      Object.keys(h).forEach((k) => {
        // restore border only if not in active state
        if (active && k === "borderColor") return;
        (el.style as any)[k] = (base as any)[k] ?? "";
      });
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
