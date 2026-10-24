import React from "react";
import type { ConverterItem } from "../types";

type Tone = "gray" | "blue" | "purple" | "green" | "amber" | "red";

const pill = (tone: Tone): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 99,
  fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
  background: `var(--badge-${tone}-bg)`, color: `var(--badge-${tone}-text)`,
});

function describe(item: ConverterItem): { label: string; tone: Tone } {
  switch (item.status) {
    case "probing":    return { label: "Reading…",    tone: "gray" };
    case "ready":      return { label: "Ready",       tone: "gray" };
    case "invalid":    return { label: "Unsupported", tone: "red" };
    case "queued":     return { label: "Queued",      tone: "blue" };
    case "processing": return { label: "Converting",  tone: "purple" };
    case "error":      return { label: "Failed",      tone: "red" };
    case "cancelled":  return { label: "Cancelled",   tone: "gray" };
    case "done":
      return item.result?.targetMet
        ? { label: "Target met",   tone: "green" }
        : { label: "Above target", tone: "amber" };
  }
}

export const StatusBadge: React.FC<{ item: ConverterItem }> = ({ item }) => {
  const { label, tone } = describe(item);
  return <span style={pill(tone)}>{label}</span>;
};
