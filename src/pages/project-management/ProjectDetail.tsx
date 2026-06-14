import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft, Pencil, Plus, ExternalLink, Github, Wrench } from "lucide-react";
import { CleanButton } from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { selectAccessData } from "../../store/slices/accessSlice";
import type { RootState } from "../../store";
import { fetchProject, markTermPaid, addPaymentTerm } from "../../services/projectApi";
import MarkPaidModal from "./MarkPaidModal";
import AddTermModal from "./AddTermModal";
import {
  type Project,
  type PaymentTerm,
  type PaymentMode,
  type AddTermPayload,
  PROJECT_STATUS_STYLE,
  PROJECT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_TERM_STATUS_STYLE,
  formatDate,
  formatCurrency,
  labelFor,
  toISO,
  PROJECT_TYPE_OPTIONS,
  DEPLOYMENT_PLATFORM_OPTIONS,
} from "./types";

// ── Small reusable pieces ──────────────────────────────────────────────────────

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500,
};

const cardStyle: React.CSSProperties = {
  background:   "var(--sc-card)",
  border:       "1px solid var(--fi-border)",
  borderRadius: 10,
  padding:      20,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize:     13,
  fontWeight:   700,
  color:        "var(--fi-label)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom:  14,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color:    "var(--fi-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 2,
};

const fieldValueStyle: React.CSSProperties = {
  fontSize:   13,
  color:      "var(--fi-text)",
  wordBreak:  "break-word",
};

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p style={fieldLabelStyle}>{label}</p>
    <div style={fieldValueStyle}>{value ?? <span style={{ color: "var(--fi-muted)" }}>—</span>}</div>
  </div>
);

const Grid: React.FC<{ cols?: number; children: React.ReactNode }> = ({ cols = 2, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 24px" }}>
    {children}
  </div>
);

// ── Payment progress bar ───────────────────────────────────────────────────────

const PaymentProgressBar: React.FC<{ paid: number; total: number }> = ({ paid, total }) => {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "var(--fi-muted)" }}>
        <span>Paid: {pct}%</span>
        <span>Due: {100 - pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--fi-border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--badge-green-text)", borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
};

// ── Term status badge ──────────────────────────────────────────────────────────

const TermBadge: React.FC<{ status: PaymentTerm["status"] }> = ({ status }) => (
  <span style={{ ...pillStyle, ...PAYMENT_TERM_STATUS_STYLE[status], fontSize: 11, padding: "2px 8px" }}>
    {status === "paid" ? "✅ Paid" : status === "overdue" ? "🔴 Overdue" : "⏳ Pending"}
  </span>
);

// ── Component ──────────────────────────────────────────────────────────────────

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const access = useSelector((s: RootState) => selectAccessData(s));
  const perms  = (access?.["project_management"] ?? {}) as Record<string, boolean>;

  const [project,   setProject]   = useState<Project | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [markPaid,  setMarkPaid]  = useState<{ open: boolean; term: PaymentTerm | null }>({ open: false, term: null });
  const [addTerm,   setAddTerm]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchProject(id);
      setProject(res.data);
      requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
    } catch {
      showToastnew.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleMarkPaid = useCallback(async (paidDate: string, paymentMode: PaymentMode | "") => {
    if (!id || !markPaid.term) return;
    setSaving(true);
    try {
      const res = await markTermPaid(id, markPaid.term.term_number, {
        paid_date:    paidDate ? toISO(paidDate) ?? undefined : undefined,
        payment_mode: paymentMode || undefined,
      });
      setProject(res.data);
      setMarkPaid({ open: false, term: null });
      showToastnew.success("Payment term marked as paid");
    } catch {
      showToastnew.error("Failed to mark term as paid");
    } finally {
      setSaving(false);
    }
  }, [id, markPaid.term]);

  const handleAddTerm = useCallback(async (payload: AddTermPayload) => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await addPaymentTerm(id, payload);
      setProject(res.data);
      setAddTerm(false);
      showToastnew.success("Payment term added");
    } catch {
      showToastnew.error("Failed to add payment term");
    } finally {
      setSaving(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fi-muted)", fontSize: 14 }}>
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
        <p style={{ color: "var(--fi-muted)", fontSize: 14 }}>Project not found.</p>
        <CleanButton variant="outline" size="sm" onClick={() => navigate("/projects")}>Back to list</CleanButton>
      </div>
    );
  }

  const nextTermNumber = project.payment_terms.length > 0
    ? Math.max(...project.payment_terms.map((t) => t.term_number)) + 1
    : 1;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--sc-shell)" }} className="sc-scrollbar">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <CleanButton
            variant="ghost"
            size="sm"
            icon={<ArrowLeft style={{ width: 14, height: 14 }} />}
            onClick={() => navigate("/projects")}
            title="Back to projects"
          />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--fi-text)" }}>
              {project.project_name}
            </h1>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--fi-muted)", background: "var(--dt-header)", padding: "1px 6px", borderRadius: 4 }}>
              {project.reference_id}
            </span>
          </div>
          {perms.update !== false && (
            <CleanButton
              variant="outline"
              size="sm"
              iconLeft={<Pencil style={{ width: 13, height: 13 }} />}
              onClick={() => navigate(`/projects/${project._id}/edit`)}
            >
              Edit
            </CleanButton>
          )}
        </div>

        {/* ── Card 1: Client & Project Info ──────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={cardTitleStyle}>Client & Project Info</p>
          <Grid cols={2}>
            <Field label="Client Name" value={project.client_name} />
            <Field label="Mobile" value={project.client_mobile} />
            {project.client_alternative_mobile && (
              <Field label="Alt. Mobile" value={project.client_alternative_mobile} />
            )}
            {project.client_email && (
              <Field label="Email" value={project.client_email} />
            )}
          </Grid>

          <div style={{ borderTop: "1px solid var(--fi-border)", margin: "14px 0" }} />

          <Grid cols={2}>
            <Field label="Project Name" value={project.project_name} />
            <Field label="Project Type" value={labelFor(PROJECT_TYPE_OPTIONS, project.project_type)} />
            <Field
              label="Project Status"
              value={
                <span style={{ ...pillStyle, ...PROJECT_STATUS_STYLE[project.project_status] }}>
                  {PROJECT_STATUS_LABEL[project.project_status]}
                </span>
              }
            />
            <Field
              label="Lead Converted"
              value={project.is_lead_converted
                ? `✅ Yes${project.lead_converted_date ? ` (${formatDate(project.lead_converted_date)})` : ""}`
                : "No"}
            />
          </Grid>

          {project.project_description && (
            <div style={{ marginTop: 14 }}>
              <Field label="Description" value={<p style={{ margin: 0, lineHeight: 1.6 }}>{project.project_description}</p>} />
            </div>
          )}

          {project.project_github_link && (
            <div style={{ marginTop: 14 }}>
              <Field
                label="GitHub"
                value={
                  <a href={project.project_github_link} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--fi-text)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <Github style={{ width: 13, height: 13 }} />
                    {project.project_github_link}
                    <ExternalLink style={{ width: 11, height: 11, color: "var(--fi-muted)" }} />
                  </a>
                }
              />
            </div>
          )}
        </div>

        {/* ── Card 2: Deployment Info ────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={cardTitleStyle}>Deployment Info</p>
          <Grid cols={2}>
            <Field
              label="Frontend"
              value={project.frontend_deploy_on
                ? <span>{labelFor(DEPLOYMENT_PLATFORM_OPTIONS, project.frontend_deploy_on)}{project.frontend_deploy_url && (
                  <a href={project.frontend_deploy_url} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 8, color: "var(--fi-text)", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12 }}>
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    URL
                  </a>
                )}</span>
                : null}
            />
            <Field
              label="Backend"
              value={project.backend_deploy_on
                ? <span>{labelFor(DEPLOYMENT_PLATFORM_OPTIONS, project.backend_deploy_on)}{project.backend_deploy_url && (
                  <a href={project.backend_deploy_url} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 8, color: "var(--fi-text)", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12 }}>
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    URL
                  </a>
                )}</span>
                : null}
            />
          </Grid>
        </div>

        {/* ── Card 3: Maintenance ────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={cardTitleStyle}>Maintenance</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {project.is_maintenance_mode
              ? <span style={{ ...pillStyle, background: "var(--badge-amber-bg)", color: "var(--badge-amber-text)", gap: 5 }}>
                  <Wrench style={{ width: 11, height: 11 }} /> Maintenance Active
                </span>
              : <span style={{ ...pillStyle, background: "var(--badge-gray-bg)", color: "var(--badge-gray-text)" }}>Inactive</span>
            }
          </div>
          {project.is_maintenance_mode && (project.maintenance_start_date || project.maintenance_end_date) && (
            <Grid cols={2} >
              <div style={{ marginTop: 12 }}>
                <Field label="Start Date" value={formatDate(project.maintenance_start_date)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="End Date" value={formatDate(project.maintenance_end_date)} />
              </div>
            </Grid>
          )}
        </div>

        {/* ── Card 4: Payment Summary ────────────────────────────────────────── */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={cardTitleStyle}>Payment Summary</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Total",   value: formatCurrency(project.payment_total_amount) },
              { label: "Paid",    value: formatCurrency(project.payment_paid_amount),  color: "var(--badge-green-text)" },
              { label: "Due",     value: formatCurrency(project.payment_due_amount),   color: project.payment_due_amount > 0 ? "#ef4444" : undefined },
              { label: "Status",  value: (
                <span style={{ ...pillStyle, ...PAYMENT_STATUS_STYLE[project.payment_status] }}>
                  {PAYMENT_STATUS_LABEL[project.payment_status]}
                </span>
              )},
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--dt-bg)", border: "1px solid var(--fi-border)", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ margin: 0, fontSize: 11, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: (s.color as string) || "var(--fi-text)" }}>{s.value}</p>
              </div>
            ))}
          </div>
          <PaymentProgressBar paid={project.payment_paid_amount} total={project.payment_total_amount} />
        </div>

        {/* ── Card 5: Payment Terms ──────────────────────────────────────────── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ ...cardTitleStyle, marginBottom: 0 }}>Payment Terms ({project.payment_terms.length})</p>
            {perms.update !== false && (
              <CleanButton
                variant="outline"
                size="xs"
                iconLeft={<Plus style={{ width: 12, height: 12 }} />}
                onClick={() => setAddTerm(true)}
              >
                Add Term
              </CleanButton>
            )}
          </div>

          {project.payment_terms.length === 0 ? (
            <p style={{ color: "var(--fi-muted)", fontSize: 13 }}>No payment terms defined.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--fi-border)" }}>
                    {["#", "Amount", "Due Date", "Paid Date", "Mode", "Note", "Status", "Action"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.payment_terms.map((term) => (
                    <tr key={term.term_number} style={{ borderBottom: "1px solid var(--fi-border)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--dt-muted)", fontWeight: 600 }}>{term.term_number}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--fi-text)" }}>{formatCurrency(term.amount)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--dt-muted)" }}>{formatDate(term.due_date)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--dt-muted)" }}>{formatDate(term.paid_date)}</td>
                      <td style={{ padding: "8px 10px", color: "var(--dt-muted)", textTransform: "capitalize" }}>
                        {term.payment_mode?.replace("_", " ") || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--dt-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {term.note || "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <TermBadge status={term.status} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {term.status !== "paid" && perms.update !== false ? (
                          <CleanButton
                            variant="primary"
                            size="xs"
                            onClick={() => setMarkPaid({ open: true, term })}
                          >
                            Mark Paid
                          </CleanButton>
                        ) : (
                          <span style={{ color: "var(--dt-muted)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {markPaid.open && markPaid.term && (
        <MarkPaidModal
          isOpen={markPaid.open}
          onClose={() => setMarkPaid({ open: false, term: null })}
          onConfirm={handleMarkPaid}
          termNumber={markPaid.term.term_number}
          amount={markPaid.term.amount}
          loading={saving}
        />
      )}

      <AddTermModal
        isOpen={addTerm}
        onClose={() => setAddTerm(false)}
        onConfirm={handleAddTerm}
        nextTermNumber={nextTermNumber}
        loading={saving}
      />
    </div>
  );
};

export default ProjectDetail;
