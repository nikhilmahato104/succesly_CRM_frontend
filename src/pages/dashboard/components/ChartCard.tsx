import React from "react";

export interface ChartCardProps {
  title:      string;
  subtitle?:  string;
  action?:    React.ReactNode;
  children:   React.ReactNode;
  minHeight?: number;
  style?:     React.CSSProperties;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title, subtitle, action, children, minHeight = 220, style,
}) => (
  <div
    style={{
      background:    "var(--sc-card)",
      border:        "1px solid var(--sc-border)",
      borderRadius:  "var(--radius)",
      padding:       "13px 16px 16px",
      display:       "flex",
      flexDirection: "column",
      gap:           12,
      boxShadow:     "0 1px 2px rgba(0,0,0,0.04)",
      minWidth:      0,
      ...style,
    }}
  >
    {/* Header */}
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)", lineHeight: 1.3 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: "var(--dt-muted)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>

    {/* Chart area */}
    <div style={{ flex: 1, minHeight, position: "relative" }}>{children}</div>
  </div>
);

export default ChartCard;
