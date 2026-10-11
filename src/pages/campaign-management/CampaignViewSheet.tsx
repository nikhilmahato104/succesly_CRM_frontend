import React from "react";
import { BarChart3, ExternalLink, Pause, Pencil, Play } from "lucide-react";
import { CleanButton, CleanModal } from "../../atoms/my_clean_code_atoms";
import { CopyButton } from "./ShortLinkCard";
import {
  type Campaign,
  type Option,
  STATUS_STYLE,
  formatDateTime,
  formatNumber,
  humanize,
  labelFor,
} from "./types";

// ── Campaign quick view — bottom sheet on mobile, modal on desktop ─────────────

interface CampaignViewSheetProps {
  campaign:       Campaign | null;
  isOpen:         boolean;
  onClose:        () => void;
  industries:     Option[];
  canEdit:        boolean;
  toggling:       boolean;
  onAnalytics:    (row: Campaign) => void;
  onEdit:         (row: Campaign) => void;
  onToggleStatus: (row: Campaign) => void;
}

const sectionLabel: React.CSSProperties = {
  margin: "0 0 6px", fontSize: 11, fontWeight: 600, letterSpacing: ".04em",
  textTransform: "uppercase", color: "var(--fi-muted)",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--fi-border)", borderRadius: 10, padding: "10px 12px",
};

const linkStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, fontSize: 13, fontFamily: "ui-monospace, monospace",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none",
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: 11, color: "var(--fi-muted)" }}>{label}</p>
    <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: "var(--fi-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {value}
    </p>
  </div>
);

const LinkRow: React.FC<{ label: string; url: string; color: string; copy?: boolean }> = ({ label, url, color, copy }) => (
  <div>
    <p style={sectionLabel}>{label}</p>
    <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 6, padding: "6px 6px 6px 12px" }}>
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{ ...linkStyle, color }}>
        {url.replace(/^https?:\/\//, "")}
      </a>
      {copy && <CopyButton text={url} />}
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label.toLowerCase()}`}
        style={{ display: "flex", padding: 6, color: "var(--fi-muted)" }}>
        <ExternalLink style={{ width: 14, height: 14 }} />
      </a>
    </div>
  </div>
);

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--fi-border)" }}>
    <span style={{ fontSize: 12, color: "var(--fi-muted)", flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 12, color: "var(--fi-text)", textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{children}</span>
  </div>
);

export const CampaignViewSheet: React.FC<CampaignViewSheetProps> = ({
  campaign, isOpen, onClose, industries, canEdit, toggling, onAnalytics, onEdit, onToggleStatus,
}) => {
  if (!campaign) return null;
  const c = campaign;
  const editable = canEdit && c.is_active;

  return (
    <CleanModal
      isOpen={isOpen}
      onClose={onClose}
      title={c.name}
      subtitle={c.reference_id}
      headerExtra={
        <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500, ...STATUS_STYLE[c.status] }}>
          {humanize(c.status)}
        </span>
      }
      maxWidth={560}
      closeOnBackdrop
      footer={
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          {editable && (
            <CleanButton
              variant="outline"
              size="sm"
              loading={toggling}
              iconLeft={c.status === "active" ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
              onClick={() => onToggleStatus(c)}
              style={{ flex: 1 }}
            >
              {c.status === "active" ? "Pause" : "Resume"}
            </CleanButton>
          )}
          {editable && (
            <CleanButton variant="outline" size="sm" iconLeft={<Pencil style={{ width: 13, height: 13 }} />} onClick={() => onEdit(c)} style={{ flex: 1 }}>
              Edit
            </CleanButton>
          )}
          <CleanButton variant="primary" size="sm" iconLeft={<BarChart3 style={{ width: 13, height: 13 }} />} onClick={() => onAnalytics(c)} style={{ flex: 1 }}>
            Analytics
          </CleanButton>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Stat label="Total clicks"  value={formatNumber(c.total_clicks)} />
          <Stat label="Unique clicks" value={formatNumber(c.unique_clicks)} />
        </div>

        <LinkRow label="Short link"  url={c.short_url}       color="#6366f1" copy />
        <LinkRow label="Destination" url={c.destination_url} color="var(--fi-text)" />

        <div>
          <p style={sectionLabel}>Details</p>
          <DetailRow label="Industry">{labelFor(industries, c.industry_type)}</DetailRow>
          <DetailRow label="Source / Medium">{c.utm.utm_source} / {c.utm.utm_medium}</DetailRow>
          <DetailRow label="UTM campaign">{c.utm.utm_campaign}</DetailRow>
          {c.utm.utm_term    && <DetailRow label="UTM term">{c.utm.utm_term}</DetailRow>}
          {c.utm.utm_content && <DetailRow label="UTM content">{c.utm.utm_content}</DetailRow>}
          {c.tags.length > 0 && <DetailRow label="Tags">{c.tags.join(", ")}</DetailRow>}
          {c.start_date      && <DetailRow label="Starts">{formatDateTime(c.start_date)}</DetailRow>}
          {c.expires_at      && <DetailRow label="Expires">{formatDateTime(c.expires_at)}</DetailRow>}
          <DetailRow label="Last click">{formatDateTime(c.last_clicked_at)}</DetailRow>
          <DetailRow label="Created">{formatDateTime(c.createdAt)}</DetailRow>
        </div>

        {c.description && (
          <div>
            <p style={sectionLabel}>Description</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fi-text)", lineHeight: 1.5 }}>{c.description}</p>
          </div>
        )}
      </div>
    </CleanModal>
  );
};

export default CampaignViewSheet;
