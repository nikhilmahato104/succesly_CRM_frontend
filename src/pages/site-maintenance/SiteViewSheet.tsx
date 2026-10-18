import React, { useEffect, useState } from "react";
import { ExternalLink, Pencil, Power, Radar } from "lucide-react";
import { CleanButton, CleanModal } from "../../atoms/my_clean_code_atoms";
import { checkSiteStatus } from "../../services/siteMaintenanceApi";
import {
  type Site,
  type SiteStatus,
  MODE_STYLE,
  MODE_LABEL,
  modeKey,
  apiErrorMessage,
  formatDateTime,
} from "./types";

// ── Site quick view — bottom sheet on mobile, modal on desktop ────────────────

interface SiteViewSheetProps {
  site:     Site | null;
  isOpen:   boolean;
  onClose:  () => void;
  canEdit:  boolean;
  onEdit:   (site: Site) => void;
  onToggle: (site: Site) => void;
}

const sectionLabel: React.CSSProperties = {
  margin: "0 0 6px", fontSize: 11, fontWeight: 600, letterSpacing: ".04em",
  textTransform: "uppercase", color: "var(--fi-muted)",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--fi-border)", borderRadius: 10, padding: "10px 12px",
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--fi-border)" }}>
    <span style={{ fontSize: 12, color: "var(--fi-muted)", flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 12, color: "var(--fi-text)", textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{children}</span>
  </div>
);

/** Runs the same public lookup the website itself calls */
const LiveStatusCheck: React.FC<{ site: Site }> = ({ site }) => {
  const [result,  setResult]  = useState<SiteStatus | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setResult(null); setError(null); }, [site._id, site.is_maintenance_mode, site.is_active]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await checkSiteStatus(site.site_url));
    } catch (err) {
      setResult(null);
      setError(apiErrorMessage(err, "Status check failed"));
    } finally {
      setLoading(false);
    }
  };

  const down = !!result?.is_maintenance_mode;

  return (
    <div>
      <p style={sectionLabel}>What visitors get</p>
      <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--fi-muted)", lineHeight: 1.4 }}>
            Calls the public status endpoint for this url
          </span>
          <CleanButton
            variant="outline"
            size="xs"
            loading={loading}
            iconLeft={<Radar style={{ width: 12, height: 12 }} />}
            onClick={run}
            style={{ flexShrink: 0 }}
          >
            {result ? "Check again" : "Check live status"}
          </CleanButton>
        </div>

        {result && (
          <div style={{
            borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.5,
            ...(down ? MODE_STYLE.down : MODE_STYLE.live),
          }}>
            <strong>{down ? "Maintenance page is showing" : "Site renders normally"}</strong>
            <div style={{ opacity: 0.9 }}>
              {result.registered
                ? <>Matched <code>{result.normalized_url}</code> by {result.matched_by === "host" ? "host record" : "exact url"}</>
                : <>Not registered — reported as live</>}
            </div>
            {down && result.maintenance_message && <div style={{ marginTop: 4 }}>“{result.maintenance_message}”</div>}
          </div>
        )}
        {error && <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
      </div>
    </div>
  );
};

export const SiteViewSheet: React.FC<SiteViewSheetProps> = ({ site, isOpen, onClose, canEdit, onEdit, onToggle }) => {
  if (!site) return null;
  const key      = modeKey(site);
  const editable = canEdit && site.is_active;

  return (
    <CleanModal
      isOpen={isOpen}
      onClose={onClose}
      title={site.site_name}
      subtitle={site.reference_id}
      headerExtra={
        <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 500, ...MODE_STYLE[key] }}>
          {MODE_LABEL[key]}
        </span>
      }
      maxWidth={560}
      closeOnBackdrop
      footer={
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          {editable && (
            <CleanButton
              variant={site.is_maintenance_mode ? "primary" : "danger"}
              size="sm"
              iconLeft={<Power style={{ width: 13, height: 13 }} />}
              onClick={() => onToggle(site)}
              style={{ flex: 1 }}
            >
              {site.is_maintenance_mode ? "Bring site back" : "Take site down"}
            </CleanButton>
          )}
          {canEdit && (
            <CleanButton variant="outline" size="sm" iconLeft={<Pencil style={{ width: 13, height: 13 }} />} onClick={() => onEdit(site)} style={{ flex: 1 }}>
              Edit
            </CleanButton>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={sectionLabel}>Site url</p>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 6, padding: "6px 6px 6px 12px" }}>
            <a href={site.site_url} target="_blank" rel="noopener noreferrer" title={site.site_url}
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#6366f1", fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
              {site.site_url.replace(/^https?:\/\//, "")}
            </a>
            <a href={site.site_url} target="_blank" rel="noopener noreferrer" aria-label="Open site"
              style={{ display: "flex", padding: 6, color: "var(--fi-muted)" }}>
              <ExternalLink style={{ width: 14, height: 14 }} />
            </a>
          </div>
        </div>

        <div>
          <p style={sectionLabel}>Maintenance message</p>
          <p style={{ ...cardStyle, margin: 0, fontSize: 13, color: "var(--fi-text)", lineHeight: 1.5 }}>
            {site.maintenance_message || "—"}
          </p>
        </div>

        {site.is_active && <LiveStatusCheck site={site} />}

        <div>
          <p style={sectionLabel}>Details</p>
          <DetailRow label="Matched as"><code>{site.normalized_url}</code></DetailRow>
          <DetailRow label="Host">{site.site_host}</DetailRow>
          <DetailRow label="Record">{site.is_active ? "Active" : "Deactivated — ignored by the status check"}</DetailRow>
          <DetailRow label="Created">{formatDateTime(site.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDateTime(site.updatedAt)}</DetailRow>
        </div>
      </div>
    </CleanModal>
  );
};

export default SiteViewSheet;
