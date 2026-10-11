import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { MousePointerClick, Fingerprint, Users, Megaphone } from "lucide-react";
import { setPageTitle, clearPageTitle } from "../../store/slices/pageTitleSlice";
import { CleanDropdown, CleanInput } from "../../atoms/my_clean_code_atoms";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { StatCard } from "../dashboard/components/StatCard";
import { fetchIndustryTypes, fetchOverviewAnalytics } from "../../services/campaignApi";
import { InfoTip, LabelWithTip } from "./InfoTip";
import { useIsMobile, MOBILE_BOTTOM_SPACE } from "./useIsMobile";
import {
  AnalyticsToolbar,
  BreakdownChart,
  ColumnChart,
  ShareChart,
  TimelineChart,
  hoursSeries,
} from "./AnalyticsCharts";
import {
  type AnalyticsInterval,
  type OverviewAnalytics,
  type Option,
  apiErrorMessage,
  fillTimeline,
  formatNumber,
  labelFor,
  toDateInput,
} from "./types";

const cardStyle: React.CSSProperties = {
  background:   "var(--sc-card)",
  border:       "1px solid var(--sc-border)",
  borderRadius: 10,
  overflow:     "hidden",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600,
  color: "var(--dt-muted)", textTransform: "uppercase", whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = { padding: "8px 12px", whiteSpace: "nowrap" };

const gridStyle = (min: number): React.CSSProperties => ({
  display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
});

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateInput(d); };

/** UTM values are display-ready as stored */
const asIs = (k: string) => k;

const CampaignOverview: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobile = useIsMobile();

  const [data,        setData]        = useState<OverviewAnalytics | null>(null);
  const [industries,  setIndustries]  = useState<Option[]>([]);
  const [from,        setFrom]        = useState(daysAgo(29));
  const [to,          setTo]          = useState(toDateInput(new Date()));
  const [interval,    setIntervalVal] = useState<AnalyticsInterval>("day");
  const [industry,    setIndustry]    = useState("");
  const [utmSource,   setUtmSource]   = useState("");
  const [debouncedUtm, setDebouncedUtm] = useState("");
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    dispatch(setPageTitle({ title: "Campaign Analytics", backPath: "/campaigns" }));
    return () => { dispatch(clearPageTitle()); };
  }, [dispatch]);

  useEffect(() => {
    fetchIndustryTypes().then(setIndustries).catch(() => { /* labels fall back to humanize */ });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUtm(utmSource.trim()), 500);
    return () => clearTimeout(t);
  }, [utmSource]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchOverviewAnalytics({
        from, to, interval,
        industry_type: industry || undefined,
        utm_source:    debouncedUtm || undefined,
      }));
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to load analytics"));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
    }
  }, [from, to, interval, industry, debouncedUtm]);

  useEffect(() => { load(); }, [load]);

  const timeline = useMemo(
    () => fillTimeline(data?.timeline ?? [], from, to, interval),
    [data?.timeline, from, to, interval],
  );
  const hours = useMemo(() => hoursSeries(data?.by_hour_of_day ?? []), [data?.by_hour_of_day]);
  const industryLabel = useCallback((k: string) => labelFor(industries, k), [industries]);

  const s = data?.summary;
  const totalCampaigns = (data?.campaigns_by_industry ?? []).reduce((n, r) => n + r.campaigns, 0);
  const activeCampaigns = (data?.campaigns_by_industry ?? []).reduce((n, r) => n + r.active, 0);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--dt-bg)" }} className="sc-scrollbar">
      <div style={{
        padding: isMobile ? `10px 10px ${MOBILE_BOTTOM_SPACE}px` : "12px 14px 24px",
        display: "flex", flexDirection: "column", gap: isMobile ? 10 : 12, maxWidth: 1400, margin: "0 auto",
      }}>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <AnalyticsToolbar
          from={from}
          to={to}
          interval={interval}
          onRange={(f, t) => { setFrom(f); setTo(t); }}
          onPreset={days => { setFrom(daysAgo(days - 1)); setTo(toDateInput(new Date())); }}
          onInterval={setIntervalVal}
          extra={
            <>
              <CleanDropdown value={industry} options={industries} onChange={setIndustry}
                placeholder="All industries" clearable style={{ width: isMobile ? "calc(100% - 128px)" : 180 }} />
              <CleanInput value={utmSource} onChange={e => setUtmSource(e.target.value)}
                placeholder="UTM source" style={{ width: isMobile ? "100%" : 150 }} />
            </>
          }
        />

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gap: isMobile ? 8 : 12,
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(170px, 1fr))",
          opacity: loading ? 0.6 : 1, transition: "opacity 150ms",
        }}>
          <StatCard title={<LabelWithTip k="total_clicks">Total clicks</LabelWithTip>}       value={formatNumber(s?.total_clicks)}    icon={<MousePointerClick size={16} />} />
          <StatCard title={<LabelWithTip k="unique_clicks">Unique clicks</LabelWithTip>}     value={formatNumber(s?.unique_clicks)}   icon={<Fingerprint size={16} />} iconBg="rgba(34,197,94,0.12)" iconColor="#22c55e" />
          <StatCard title={<LabelWithTip k="unique_visitors">Unique visitors</LabelWithTip>} value={formatNumber(s?.unique_visitors)} icon={<Users size={16} />}       iconBg="rgba(6,182,212,0.12)" iconColor="#06b6d4" />
          <StatCard title={<LabelWithTip k="campaigns">Campaigns</LabelWithTip>}             value={formatNumber(totalCampaigns)}     icon={<Megaphone size={16} />}   iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6"
            subtitle={`${formatNumber(activeCampaigns)} active`} />
        </div>

        <TimelineChart title="Clicks over time" subtitle={`${from} → ${to}`} rows={timeline} tip="timeline" />

        {/* ── Channel comparison ───────────────────────────────────────── */}
        <div style={gridStyle(300)}>
          <BreakdownChart title="By industry"    rows={data?.by_industry ?? []} formatKey={industryLabel} tip="by_industry" />
          <BreakdownChart title="By UTM source"  rows={data?.by_utm_source ?? []} formatKey={asIs} color="#06b6d4" tip="by_utm_source" />
          <BreakdownChart title="By UTM medium"  rows={data?.by_utm_medium ?? []} formatKey={asIs} color="#8b5cf6" tip="by_utm_medium" />
        </div>

        <div style={gridStyle(300)}>
          <BreakdownChart title="By UTM campaign" rows={data?.by_utm_campaign ?? []} formatKey={asIs} color="#f59e0b" tip="by_utm_campaign" />
          <ShareChart     title="Device"          rows={data?.by_device ?? []} tip="device" />
          <BreakdownChart title="Country"         rows={data?.by_country ?? []} formatKey={asIs} color="#ec4899" tip="country" />
        </div>

        <div style={gridStyle(300)}>
          <ColumnChart    title="Hour of day" labels={hours.labels} values={hours.values} tip="hour_of_day" />
          <BreakdownChart title="Browser"     rows={data?.by_browser ?? []} formatKey={asIs} color="#14b8a6" tip="browser" />
          <BreakdownChart title="OS"          rows={data?.by_os ?? []} formatKey={asIs} color="#64748b" tip="os" />
        </div>

        {/* ── Top campaigns ────────────────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--sc-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)", display: "flex", alignItems: "center", gap: 4 }}>Top campaigns <InfoTip k="top_campaigns" /></div>
            <div style={{ fontSize: 11, color: "var(--dt-muted)" }}>Most clicked in this period — click a row for details</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--dt-header)" }}>
                  {["Campaign", "Short URL name", "Industry", "Source / Medium", "Clicks", "Unique"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.top_campaigns ?? []).map(c => (
                  <tr key={c.campaign_id}
                    onClick={() => navigate(`/campaigns/${c.campaign_id}`)}
                    style={{ borderTop: "1px solid var(--sc-border)", color: "var(--dt-text)", cursor: "pointer" }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name ?? "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "ui-monospace, monospace", color: "#6366f1" }}>{c.slug ?? "—"}</td>
                    <td style={tdStyle}>{c.industry_type ? labelFor(industries, c.industry_type) : "—"}</td>
                    <td style={tdStyle}>{c.utm_source ?? "—"} / {c.utm_medium ?? "—"}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{formatNumber(c.clicks)}</td>
                    <td style={tdStyle}>{formatNumber(c.unique_clicks)}</td>
                  </tr>
                ))}
                {data && data.top_campaigns.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--dt-muted)" }}>No clicks in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Campaigns by industry (all-time counters) ────────────────── */}
        <div style={cardStyle}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--sc-border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)", display: "flex", alignItems: "center", gap: 4 }}>Campaigns by industry <InfoTip k="by_industry_table" /></div>
            <div style={{ fontSize: 11, color: "var(--dt-muted)" }}>All-time totals for live (non-archived) campaigns</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--dt-header)" }}>
                  {["Industry", "Campaigns", "Active", "Clicks", "Unique", "Avg clicks / campaign"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.campaigns_by_industry ?? []).map(r => (
                  <tr key={r.industry_type} style={{ borderTop: "1px solid var(--sc-border)", color: "var(--dt-text)" }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{labelFor(industries, r.industry_type)}</td>
                    <td style={tdStyle}>{formatNumber(r.campaigns)}</td>
                    <td style={tdStyle}>{formatNumber(r.active)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{formatNumber(r.total_clicks)}</td>
                    <td style={tdStyle}>{formatNumber(r.unique_clicks)}</td>
                    <td style={tdStyle}>{r.avg_clicks_per_campaign}</td>
                  </tr>
                ))}
                {data && data.campaigns_by_industry.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--dt-muted)" }}>No campaigns yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CampaignOverview;
