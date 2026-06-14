import React from "react";
import { X, ArrowRight } from "lucide-react";
import type { ActivityLogItem } from "../../services/activityLogApi";

// ── Badge helpers ─────────────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
};

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  create:    { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  update:    { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  delete:    { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
  view:      { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  list:      { background: "var(--badge-gray-bg)",   color: "var(--badge-gray-text)"   },
  mark_paid: { background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)" },
  add_term:  { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
};

const METHOD_STYLE: Record<string, React.CSSProperties> = {
  GET:    { background: "var(--badge-blue-bg)",   color: "var(--badge-blue-text)"   },
  POST:   { background: "var(--badge-green-bg)",  color: "var(--badge-green-text)"  },
  PATCH:  { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)"  },
  PUT:    { background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" },
  DELETE: { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"    },
};

function statusStyle(code: number): React.CSSProperties {
  if (code >= 500) return { background: "var(--badge-red-bg)",    color: "var(--badge-red-text)"   };
  if (code >= 400) return { background: "var(--badge-amber-bg)",  color: "var(--badge-amber-text)" };
  return                   { background: "var(--badge-green-bg)", color: "var(--badge-green-text)" };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Section ───────────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fi-muted)" }}>
      {title}
    </p>
    {children}
  </div>
);

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--fi-border)" }}>
    <span style={{ width: 110, flexShrink: 0, fontSize: 11, color: "var(--fi-muted)", fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: 12, color: "var(--fi-text)", flex: 1, wordBreak: "break-word" }}>{children}</span>
  </div>
);

// ── ActivityLogDetail ─────────────────────────────────────────────────────────

interface Props {
  log:     ActivityLogItem;
  onClose: () => void;
}

const ActivityLogDetail: React.FC<Props> = ({ log, onClose }) => {
  const actionStyle = ACTION_STYLE[log.action]  ?? { background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" };
  const methodStyle = METHOD_STYLE[log.method]  ?? { background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.30)", zIndex: 100 }}
      />

      {/* Panel */}
      <div
        style={{
          position:       "fixed",
          top:            0,
          right:          0,
          bottom:         0,
          width:          "min(520px, 95vw)",
          background:     "var(--sc-card)",
          borderLeft:     "1px solid var(--fi-border)",
          boxShadow:      "-4px 0 24px rgba(0,0,0,0.15)",
          zIndex:         101,
          display:        "flex",
          flexDirection:  "column",
          overflow:       "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--fi-border)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...pillStyle, ...actionStyle, textTransform: "capitalize" }}>{log.action}</span>
            <span style={{ ...pillStyle, fontSize: 10, background: "var(--sc-surface)", color: "var(--fi-muted)", textTransform: "capitalize" }}>{log.module}</span>
          </div>
          <button
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "var(--fi-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--sb-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }} className="sc-scrollbar">

          {/* Entity */}
          <Section title="Entity">
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--fi-text)" }}>
              {log.entity_ref || "—"}
            </p>
          </Section>

          {/* Description */}
          <Section title="Description">
            <p style={{ margin: 0, fontSize: 12, color: "var(--fi-text)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {log.description || "—"}
            </p>
          </Section>

          {/* Field-level diff */}
          {log.changes && log.changes.length > 0 && (
            <Section title={`Changes (${log.changes.length} field${log.changes.length > 1 ? "s" : ""})`}>
              <div style={{ border: "1px solid var(--fi-border)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "var(--sc-surface)" }}>
                      {["Field", "Before", "", "After"].map((h, i) => (
                        <th key={i} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, borderBottom: "1px solid var(--fi-border)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {log.changes.map((c, i) => (
                      <tr key={i} style={{ borderBottom: i < log.changes.length - 1 ? "1px solid var(--fi-border)" : "none" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--fi-text)", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                          {c.field}
                        </td>
                        <td style={{ padding: "7px 10px", color: "var(--badge-red-text)", background: "rgba(239,68,68,0.06)", maxWidth: 120, wordBreak: "break-all" }}>
                          {String(c.from ?? "—")}
                        </td>
                        <td style={{ padding: "7px 6px", color: "var(--fi-muted)" }}>
                          <ArrowRight style={{ width: 12, height: 12 }} />
                        </td>
                        <td style={{ padding: "7px 10px", color: "var(--badge-green-text)", background: "rgba(34,197,94,0.06)", maxWidth: 120, wordBreak: "break-all" }}>
                          {String(c.to ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* API Metrics */}
          <Section title="API Metrics">
            <MetaRow label="Method">
              <span style={{ ...pillStyle, ...methodStyle }}>{log.method}</span>
            </MetaRow>
            <MetaRow label="Endpoint">
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all" }}>{log.endpoint}</span>
            </MetaRow>
            <MetaRow label="Status">
              <span style={{ ...pillStyle, ...statusStyle(log.status_code) }}>
                {log.status_code}
              </span>
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--fi-muted)" }}>
                {log.is_success ? "Success" : "Failed"}
              </span>
            </MetaRow>
            <MetaRow label="Response Time">{log.response_time_ms}ms</MetaRow>
            <MetaRow label="IP Address">{log.ip_address || "—"}</MetaRow>
            <MetaRow label="User">{log.user_email}</MetaRow>
            <MetaRow label="Timestamp">{formatDateTime(log.createdAt)}</MetaRow>
          </Section>

        </div>
      </div>
    </>
  );
};

export default ActivityLogDetail;
