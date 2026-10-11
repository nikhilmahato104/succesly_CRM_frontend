import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  MousePointerClick, Fingerprint, Users, Bot, Clock, Pencil, Pause, Play, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { setPageTitle, clearPageTitle } from "../../store/slices/pageTitleSlice";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import { CleanButton } from "../../atoms/my_clean_code_atoms";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { StatCard } from "../dashboard/components/StatCard";
import {
  fetchCampaign,
  fetchCampaignAnalytics,
  fetchCampaignClicks,
  fetchIndustryTypes,
  updateCampaign,
} from "../../services/campaignApi";
import { ShortLinkCard } from "./ShortLinkCard";
import { InfoTip, LabelWithTip } from "./InfoTip";
import { useIsMobile, MOBILE_BOTTOM_SPACE } from "./useIsMobile";
import {
  AnalyticsToolbar,
  BreakdownChart,
  ColumnChart,
  ShareChart,
  TimelineChart,
  hoursSeries,
  weekdaySeries,
} from "./AnalyticsCharts";
import {
  type AnalyticsInterval,
  type Campaign,
  type CampaignAnalytics as Analytics,
  type CampaignClick,
  type Option,
  type PageResult,
  CAMPAIGN_MODULE_ID,
  STATUS_STYLE,
  apiErrorMessage,
  fillTimeline,
  formatDateTime,
  formatNumber,
  humanize,
  labelFor,
  toDateInput,
} from "./types";

const cardStyle: React.CSSProperties = {
  background:   "var(--sc-card)",
  border:       "1px solid var(--sc-border)",
  borderRadius: 10,
  padding:      16,
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500,
};

const gridStyle = (min: number): React.CSSProperties => ({
  display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
});

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateInput(d); };

const CLICKS_PER_PAGE = 20;

/** Browser / OS / country names are already display-ready */
const asIs = (k: string) => k;

const CampaignAnalytics: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const access   = useSelector((s: RootState) => selectAccessData(s));
  const perms    = (access?.[CAMPAIGN_MODULE_ID] ?? {}) as Record<string, boolean>;
  const isMobile = useIsMobile();

  const [campaign,    setCampaign]    = useState<Campaign | null>(null);
  const [analytics,   setAnalytics]   = useState<Analytics | null>(null);
  const [industries,  setIndustries]  = useState<Option[]>([]);
  const [from,        setFrom]        = useState(daysAgo(29));
  const [to,          setTo]          = useState(toDateInput(new Date()));
  const [interval,    setIntervalVal] = useState<AnalyticsInterval>("day");
  const [includeBots, setIncludeBots] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [toggling,    setToggling]    = useState(false);

  const [clicks,      setClicks]      = useState<PageResult<CampaignClick> | null>(null);
  const [clicksPage,  setClicksPage]  = useState(1);
  const [clicksBusy,  setClicksBusy]  = useState(false);

  useEffect(() => {
    dispatch(setPageTitle({ title: campaign?.name ?? "Campaign Analytics", backPath: "/campaigns" }));
    return () => { dispatch(clearPageTitle()); };
  }, [dispatch, campaign?.name]);

  useEffect(() => {
    fetchIndustryTypes().then(setIndustries).catch(() => { /* labels fall back to humanize */ });
  }, []);

  const loadCampaign = useCallback(async () => {
    try {
      setCampaign(await fetchCampaign(id));
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to load campaign"));
    }
  }, [id]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      setAnalytics(await fetchCampaignAnalytics(id, { from, to, interval, include_bots: includeBots }));
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to load analytics"));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
    }
  }, [id, from, to, interval, includeBots]);

  const loadClicks = useCallback(async () => {
    setClicksBusy(true);
    try {
      setClicks(await fetchCampaignClicks(id, { page: clicksPage, limit: CLICKS_PER_PAGE, from, to }));
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to load click log"));
    } finally {
      setClicksBusy(false);
    }
  }, [id, clicksPage, from, to]);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadClicks(); }, [loadClicks]);
  useEffect(() => { setClicksPage(1); }, [from, to]);

  const refreshAll = () => { loadCampaign(); loadAnalytics(); loadClicks(); };

  const handleToggleStatus = async () => {
    if (!campaign) return;
    const next = campaign.status === "active" ? "paused" : "active";
    setToggling(true);
    try {
      const res = await updateCampaign(campaign._id, { status: next });
      setCampaign(res.data);
      showToastnew.success(next === "paused" ? "Link paused" : "Link resumed");
    } catch (err) {
      showToastnew.error(apiErrorMessage(err, "Failed to update status"));
    } finally {
      setToggling(false);
    }
  };

  const timeline = useMemo(
    () => fillTimeline(analytics?.timeline ?? [], from, to, interval),
    [analytics?.timeline, from, to, interval],
  );
  const hours    = useMemo(() => hoursSeries(analytics?.by_hour_of_day ?? []), [analytics?.by_hour_of_day]);
  const weekdays = useMemo(() => weekdaySeries(analytics?.by_day_of_week ?? []), [analytics?.by_day_of_week]);

  const s = analytics?.summary;
  const canEdit = perms.edit !== false && campaign?.is_active;

  const iconSize = { width: 14, height: 14 };
  const smallPill: React.CSSProperties = { ...pillStyle, fontSize: 11, padding: "1px 8px" };

  const visitorBadge = (c: CampaignClick) =>
    c.is_bot
      ? <span style={{ ...smallPill, ...STATUS_STYLE.archived }}>Bot</span>
      : c.is_unique
        ? <span style={{ ...smallPill, ...STATUS_STYLE.active }}>New</span>
        : <span style={{ fontSize: 11, color: "var(--dt-muted)" }}>Returning</span>;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--dt-bg)" }} className="sc-scrollbar">
      <div style={{
        padding: isMobile ? `10px 10px ${MOBILE_BOTTOM_SPACE}px` : "12px 14px 24px",
        display: "flex", flexDirection: "column", gap: isMobile ? 10 : 12, maxWidth: 1400, margin: "0 auto",
      }}>

        {/* ── Campaign header + short link ─────────────────────────────── */}
        {campaign && (
          <div style={{ ...cardStyle, padding: isMobile ? 12 : 16 }}>
            <div style={{
              display: "flex", gap: 10, marginBottom: 14,
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "flex-start",
              justifyContent: "space-between",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 17, fontWeight: 700, color: "var(--dt-text)", lineHeight: 1.3 }}>
                    {campaign.name}
                  </h2>
                  <span style={{ ...pillStyle, ...STATUS_STYLE[campaign.status] }}>{humanize(campaign.status)}</span>
                  <InfoTip k="status" />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--dt-muted)", lineHeight: 1.5 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{campaign.reference_id}</span>
                  {" · "}{labelFor(industries, campaign.industry_type)}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--dt-muted)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {campaign.utm.utm_source} / {campaign.utm.utm_medium} / {campaign.utm.utm_campaign}
                  <InfoTip k="utm" />
                </p>
                {(campaign.start_date || campaign.expires_at) && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--dt-muted)" }}>
                    {campaign.start_date && <>Starts {formatDateTime(campaign.start_date)}</>}
                    {campaign.start_date && campaign.expires_at && " · "}
                    {campaign.expires_at && <>Expires {formatDateTime(campaign.expires_at)}</>}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <CleanButton variant="outline" size="md" className="no-min-tap" icon={<RefreshCw style={iconSize} />}
                  onClick={refreshAll} title="Refresh" style={{ width: 34, flexShrink: 0 }} />
                {canEdit && (
                  <CleanButton variant="outline" size="md" className="no-min-tap" loading={toggling}
                    iconLeft={campaign.status === "active" ? <Pause style={iconSize} /> : <Play style={iconSize} />}
                    onClick={handleToggleStatus} style={isMobile ? { flex: 1, justifyContent: "center" } : undefined}>
                    {campaign.status === "active" ? "Pause" : "Resume"}
                  </CleanButton>
                )}
                {canEdit && (
                  <CleanButton variant="primary" size="md" className="no-min-tap" iconLeft={<Pencil style={iconSize} />}
                    onClick={() => navigate(`/campaigns/${campaign._id}/edit`)}
                    style={isMobile ? { flex: 1, justifyContent: "center" } : undefined}>
                    Edit
                  </CleanButton>
                )}
              </div>
            </div>
            <ShortLinkCard
              shortUrl={campaign.short_url}
              shortUrlPath={campaign.short_url_path}
              slug={campaign.slug}
              destinationUrl={campaign.destination_url}
              finalUrl={campaign.final_url}
            />
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <AnalyticsToolbar
          from={from}
          to={to}
          interval={interval}
          onRange={(f, t) => { setFrom(f); setTo(t); }}
          onPreset={days => { setFrom(daysAgo(days - 1)); setTo(toDateInput(new Date())); }}
          onInterval={setIntervalVal}
          extra={
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dt-text)", height: "var(--fi-height)", cursor: "pointer" }}>
              <input type="checkbox" checked={includeBots} onChange={e => setIncludeBots(e.target.checked)} />
              Include bots
              <InfoTip k="bot_hits" />
            </label>
          }
        />

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "grid", gap: isMobile ? 8 : 12,
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(170px, 1fr))",
          opacity: loading ? 0.6 : 1, transition: "opacity 150ms",
        }}>
          <StatCard title={<LabelWithTip k="total_clicks">Total clicks</LabelWithTip>}       value={formatNumber(s?.total_clicks)}    icon={<MousePointerClick size={16} />} />
          <StatCard title={<LabelWithTip k="unique_clicks">Unique clicks</LabelWithTip>}     value={formatNumber(s?.unique_clicks)}   icon={<Fingerprint size={16} />} iconBg="rgba(34,197,94,0.12)"  iconColor="#22c55e" />
          <StatCard title={<LabelWithTip k="unique_visitors">Unique visitors</LabelWithTip>} value={formatNumber(s?.unique_visitors)} icon={<Users size={16} />}       iconBg="rgba(6,182,212,0.12)"  iconColor="#06b6d4" />
          <StatCard title={<LabelWithTip k="bot_hits">Bot hits</LabelWithTip>}              value={formatNumber(s?.bot_clicks)}      icon={<Bot size={16} />}         iconBg="rgba(128,128,128,0.12)" iconColor="#737373"
            subtitle={includeBots ? "Included" : "Excluded"} />
          <div style={isMobile ? { gridColumn: "1 / -1" } : undefined}>
            <StatCard title={<LabelWithTip k="last_click">Last click</LabelWithTip>}
              value={s?.last_click_at ? formatDateTime(s.last_click_at).split(",")[0] : "—"}
              icon={<Clock size={16} />} iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b"
              subtitle={s?.last_click_at ? formatDateTime(s.last_click_at) : "No clicks yet"} />
          </div>
        </div>

        {/* ── Charts ───────────────────────────────────────────────────── */}
        <TimelineChart title="Clicks over time" subtitle={`${from} → ${to}`} rows={timeline} tip="timeline" />

        <div style={gridStyle(300)}>
          <ShareChart     title="Device"  rows={analytics?.by_device ?? []} tip="device" />
          <BreakdownChart title="Browser" rows={analytics?.by_browser ?? []} formatKey={asIs} tip="browser" />
          <BreakdownChart title="OS"      rows={analytics?.by_os ?? []} formatKey={asIs} color="#8b5cf6" tip="os" />
        </div>

        <div style={gridStyle(300)}>
          <BreakdownChart title="Referrer" rows={analytics?.by_referrer ?? []} formatKey={asIs} color="#06b6d4" tip="referrer" />
          <BreakdownChart title="Country"  rows={analytics?.by_country ?? []} formatKey={asIs} color="#f59e0b" tip="country" />
          <BreakdownChart title="City"     rows={analytics?.by_city ?? []} formatKey={asIs} color="#ec4899" tip="city" />
        </div>

        <div style={gridStyle(300)}>
          <ColumnChart title="Hour of day" labels={hours.labels}    values={hours.values} tip="hour_of_day" />
          <ColumnChart title="Day of week" labels={weekdays.labels} values={weekdays.values} color="#8b5cf6" tip="day_of_week" />
          <ShareChart  title="Link type"   rows={analytics?.by_access_type ?? []} tip="link_type" />
        </div>

        {/* ── Raw click log ────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--sc-border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dt-text)", display: "flex", alignItems: "center", gap: 4 }}>
                Click log <InfoTip k="click_log" />
              </div>
              <div style={{ fontSize: 11, color: "var(--dt-muted)" }}>
                {clicks ? `${formatNumber(clicks.total)} hits · newest first` : "Newest first"}
              </div>
            </div>
            {clicks && clicks.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dt-muted)", flexShrink: 0 }}>
                <CleanButton variant="outline" size="md" className="no-min-tap" icon={<ChevronLeft style={iconSize} />}
                  disabled={clicksPage <= 1 || clicksBusy} onClick={() => setClicksPage(p => p - 1)} style={{ width: 32 }} />
                {clicksPage} / {clicks.totalPages}
                <CleanButton variant="outline" size="md" className="no-min-tap" icon={<ChevronRight style={iconSize} />}
                  disabled={clicksPage >= clicks.totalPages || clicksBusy} onClick={() => setClicksPage(p => p + 1)} style={{ width: 32 }} />
              </div>
            )}
          </div>

          {isMobile ? (
            // Mobile: one compact card per click instead of an 8-column table
            <div style={{ opacity: clicksBusy ? 0.6 : 1 }}>
              {(clicks?.data ?? []).map(c => (
                <div key={c._id} style={{ padding: "10px 14px", borderTop: "1px solid var(--sc-border)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--dt-text)" }}>{formatDateTime(c.clicked_at)}</span>
                    {visitorBadge(c)}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--dt-text)" }}>
                    {humanize(c.device_type)} · {c.browser} · {c.os}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--dt-muted)" }}>
                    {[c.city, c.country].filter(Boolean).join(", ") || "Location unknown"}
                    {" · "}{c.referrer_domain ?? "—"}{" · "}{humanize(c.access_type)} link
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto", opacity: clicksBusy ? 0.6 : 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--dt-header)" }}>
                    {["Time", "Device", "Browser", "OS", "Location", "Referrer", "Visitor", "Link"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "var(--dt-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(clicks?.data ?? []).map(c => (
                    <tr key={c._id} style={{ borderTop: "1px solid var(--sc-border)", color: "var(--dt-text)" }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{formatDateTime(c.clicked_at)}</td>
                      <td style={{ padding: "8px 12px" }}>{humanize(c.device_type)}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{c.browser}{c.browser_version ? ` ${c.browser_version.split(".")[0]}` : ""}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{c.os}{c.os_version ? ` ${c.os_version}` : ""}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>{c.referrer_domain ?? "—"}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{visitorBadge(c)}</td>
                      <td style={{ padding: "8px 12px", color: "var(--dt-muted)" }}>{humanize(c.access_type)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {clicks && clicks.data.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--dt-muted)", fontSize: 12, borderTop: "1px solid var(--sc-border)" }}>
              No clicks in this period — open the short link in a browser tab to test it.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CampaignAnalytics;
