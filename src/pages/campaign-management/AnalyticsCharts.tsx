import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { ChartCard } from "../dashboard/components/ChartCard";
import { useChartTheme } from "../dashboard/components/useChartTheme";
import { CleanDateRangePicker, CleanDropdown } from "../../atoms/my_clean_code_atoms";
import { INTERVAL_OPTIONS, humanize, type AnalyticsInterval, type BreakdownRow, type TimelineRow } from "./types";
import { InfoTip } from "./InfoTip";
import { useIsMobile } from "./useIsMobile";
import type { MeaningKey } from "./meanings";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
);

export const PALETTE = ["#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6", "#84cc16", "#64748b"];

const tooltipStyle = (theme: ReturnType<typeof useChartTheme>) => ({
  backgroundColor: theme.tooltipBg,
  titleColor:      theme.tooltipText,
  bodyColor:       theme.tooltipText,
  borderColor:     theme.gridColor,
  borderWidth:     1,
  padding:         8,
});

const Empty: React.FC<{ text?: string }> = ({ text = "No clicks in this period" }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--dt-muted)" }}>
    {text}
  </div>
);

// ── Timeline (clicks + unique over time) ───────────────────────────────────────

export const TimelineChart: React.FC<{ title: string; subtitle?: string; rows: TimelineRow[]; tip?: MeaningKey }> = ({ title, subtitle, rows, tip }) => {
  const theme = useChartTheme();
  const hasData = rows.some(r => r.clicks > 0);

  const data = useMemo(() => ({
    labels: rows.map(r => r.period),
    datasets: [
      {
        label: "Clicks", data: rows.map(r => r.clicks),
        borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)",
        fill: true, tension: 0.35, pointRadius: rows.length > 60 ? 0 : 2, borderWidth: 2,
      },
      {
        label: "Unique", data: rows.map(r => r.unique_clicks),
        borderColor: "#22c55e", backgroundColor: "transparent",
        fill: false, tension: 0.35, pointRadius: rows.length > 60 ? 0 : 2, borderWidth: 2, borderDash: [4, 3],
      },
    ],
  }), [rows]);

  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { position: "top" as const, align: "end" as const, labels: { color: theme.textColor, font: { size: 11 }, boxWidth: 9, boxHeight: 9 } },
      tooltip: tooltipStyle(theme),
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
      y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 }, beginAtZero: true },
    },
  }), [theme]);

  return (
    <ChartCard title={title} subtitle={subtitle} minHeight={240} action={tip && <InfoTip k={tip} />}>
      {hasData ? <Line data={data} options={options} /> : <Empty />}
    </ChartCard>
  );
};

// ── Horizontal bar breakdown ([{ key, clicks, unique_clicks }]) ─────────────────

export const BreakdownChart: React.FC<{
  title:      string;
  rows:       BreakdownRow[];
  formatKey?: (key: string) => string;
  color?:     string;
  tip?:       MeaningKey;
}> = ({ title, rows, formatKey = humanize, color = "#6366f1", tip }) => {
  const theme = useChartTheme();

  const data = useMemo(() => ({
    labels: rows.map(r => formatKey(String(r.key))),
    datasets: [
      { label: "Clicks", data: rows.map(r => r.clicks),        backgroundColor: color,                 borderRadius: 4, barThickness: 12 },
      { label: "Unique", data: rows.map(r => r.unique_clicks), backgroundColor: "rgba(34,197,94,0.75)", borderRadius: 4, barThickness: 12 },
    ],
  }), [rows, formatKey, color]);

  const options = useMemo(() => ({
    indexAxis: "y" as const,
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipStyle(theme),
    },
    scales: {
      x: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, font: { size: 10 }, precision: 0 }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 11 } } },
    },
  }), [theme]);

  const height = Math.max(160, rows.length * 34);

  return (
    <ChartCard title={title} subtitle="Clicks · unique" minHeight={height} action={tip && <InfoTip k={tip} />}>
      {rows.length > 0 ? <Bar data={data} options={options} /> : <Empty />}
    </ChartCard>
  );
};

// ── Doughnut share ─────────────────────────────────────────────────────────────

export const ShareChart: React.FC<{ title: string; rows: BreakdownRow[]; formatKey?: (key: string) => string; tip?: MeaningKey }> = ({
  title, rows, formatKey = humanize, tip,
}) => {
  const theme = useChartTheme();

  const data = useMemo(() => ({
    labels: rows.map(r => formatKey(String(r.key))),
    datasets: [{ data: rows.map(r => r.clicks), backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 6 }],
  }), [rows, formatKey]);

  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, cutout: "68%",
    plugins: {
      legend: { position: "bottom" as const, labels: { color: theme.textColor, font: { size: 11 }, padding: 12, boxWidth: 9, boxHeight: 9 } },
      tooltip: tooltipStyle(theme),
    },
  }), [theme]);

  return (
    <ChartCard title={title} minHeight={220} action={tip && <InfoTip k={tip} />}>
      {rows.length > 0 ? <Doughnut data={data} options={options} /> : <Empty />}
    </ChartCard>
  );
};

// ── Simple vertical bars (hour of day / day of week) ───────────────────────────

export const ColumnChart: React.FC<{ title: string; labels: string[]; values: number[]; color?: string; tip?: MeaningKey }> = ({
  title, labels, values, color = "#06b6d4", tip,
}) => {
  const theme = useChartTheme();
  const hasData = values.some(v => v > 0);

  const data = useMemo(() => ({
    labels,
    datasets: [{ label: "Clicks", data: values, backgroundColor: color, borderRadius: 4 }],
  }), [labels, values, color]);

  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipStyle(theme) },
    scales: {
      x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 0 } },
      y: { grid: { color: theme.gridColor }, ticks: { color: theme.textColor, font: { size: 11 }, precision: 0 }, beginAtZero: true },
    },
  }), [theme]);

  return (
    <ChartCard title={title} minHeight={200} action={tip && <InfoTip k={tip} />}>
      {hasData ? <Bar data={data} options={options} /> : <Empty />}
    </ChartCard>
  );
};

/** API returns only hours that had clicks — expand to all 24 */
export function hoursSeries(rows: { hour: number; clicks: number }[]) {
  const byHour = new Map(rows.map(r => [r.hour, r.clicks]));
  const labels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
  return { labels, values: labels.map((_, h) => byHour.get(h) ?? 0) };
}

/** API day_number: 1 = Sunday … 7 = Saturday — show Mon-first */
export function weekdaySeries(rows: { day_number: number; clicks: number }[]) {
  const byDay = new Map(rows.map(r => [r.day_number, r.clicks]));
  const order = [2, 3, 4, 5, 6, 7, 1];
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return { labels: names, values: order.map(d => byDay.get(d) ?? 0) };
}

// ── Date range + interval toolbar ──────────────────────────────────────────────

export const RANGE_PRESETS = [
  { label: "7D",  days: 7   },
  { label: "30D", days: 30  },
  { label: "90D", days: 90  },
];

export const AnalyticsToolbar: React.FC<{
  from:       string;
  to:         string;
  interval:   AnalyticsInterval;
  onRange:    (from: string, to: string) => void;
  onInterval: (v: AnalyticsInterval) => void;
  onPreset:   (days: number) => void;
  extra?:     React.ReactNode;
}> = ({ from, to, interval, onRange, onInterval, onPreset, extra }) => {
  const isMobile = useIsMobile();

  // Highlight the preset that matches the current range (to = today)
  const today = new Date();
  const activeDays = (() => {
    const t = new Date(`${to}T00:00:00`);
    const f = new Date(`${from}T00:00:00`);
    if (t.toDateString() !== today.toDateString()) return null;
    return Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  })();

  const presets = (
    <div style={{
      display: "flex", padding: 2, borderRadius: "var(--fi-radius)",
      border: "1px solid var(--fi-border)", background: "var(--sc-card)",
      ...(isMobile && { width: "100%" }),
    }}>
      {RANGE_PRESETS.map(p => {
        const active = activeDays === p.days;
        return (
          <button
            key={p.label}
            type="button"
            className="no-min-tap"
            onClick={() => onPreset(p.days)}
            style={{
              flex: isMobile ? 1 : undefined,
              height: "calc(var(--fi-height) - 4px)", padding: "0 12px", borderRadius: "var(--radius)", border: "none",
              background: active ? "#6366f1" : "transparent",
              color: active ? "#fff" : "var(--dt-text)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: "flex", gap: isMobile ? 8 : 10,
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "stretch" : "center",
      flexWrap: "wrap",
    }}>
      {presets}
      <CleanDateRangePicker
        fromValue={from}
        toValue={to}
        onFromChange={v => onRange(v, to)}
        onToChange={v => onRange(from, v)}
        style={isMobile ? { width: "100%" } : { minWidth: 260 }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <CleanDropdown
          value={interval}
          options={INTERVAL_OPTIONS}
          onChange={v => onInterval((v || "day") as AnalyticsInterval)}
          style={{ width: isMobile ? 120 : 130 }}
        />
        {extra}
      </div>
    </div>
  );
};
