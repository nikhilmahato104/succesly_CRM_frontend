import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCardProps {
  title:      React.ReactNode;
  value:      string;
  icon:       React.ReactNode;
  iconBg?:    string;
  iconColor?: string;
  change?:    number;   // % change — positive=up, negative=down, 0=flat
  period?:    string;   // "vs last month"
  subtitle?:  string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title, value, icon,
  iconBg    = "rgba(99,102,241,0.12)",
  iconColor = "#6366f1",
  change, period = "vs last month", subtitle,
}) => {
  const positive = change !== undefined && change > 0;
  const negative = change !== undefined && change < 0;
  const flat     = change !== undefined && change === 0;

  return (
    <div
      style={{
        background:   "var(--sc-card)",
        border:       "1px solid var(--sc-border)",
        borderRadius: 10,
        padding:      "13px 14px",
        display:      "flex",
        flexDirection:"column",
        gap:          9,
        boxShadow:    "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Top row: icon + change badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width:          34,
            height:         34,
            borderRadius:   8,
            background:     iconBg,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            color:          iconColor,
            flexShrink:     0,
          }}
        >
          {icon}
        </div>

        {change !== undefined && (
          <div
            style={{
              display:     "flex",
              alignItems:  "center",
              gap:         3,
              padding:     "2px 6px",
              borderRadius: 99,
              fontSize:    11,
              fontWeight:  600,
              background:  positive ? "rgba(34,197,94,0.12)"   : negative ? "rgba(239,68,68,0.12)"  : "rgba(128,128,128,0.09)",
              color:       positive ? "#22c55e"                 : negative ? "#ef4444"               : "var(--dt-muted)",
            }}
          >
            {positive && <TrendingUp  size={9} />}
            {negative && <TrendingDown size={9} />}
            {flat     && <Minus        size={9} />}
            {positive ? "+" : ""}{Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Value + title */}
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--dt-text)", lineHeight: 1.1, letterSpacing: "-0.025em" }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: "var(--dt-dim)", marginTop: 3, fontWeight: 500 }}>
          {title}
        </div>
        {(subtitle || change !== undefined) && (
          <div style={{ fontSize: 11, color: "var(--dt-muted)", marginTop: 3 }}>
            {subtitle ?? period}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
