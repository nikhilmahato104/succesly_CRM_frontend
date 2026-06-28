import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { setPageTitle, clearPageTitle } from "../../store/slices/pageTitleSlice";
import {
  CleanButton,
  CleanInput,
  CleanSelect,
  CleanTextarea,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { createProject, fetchProject, updateProject } from "../../services/projectApi";
import {
  PROJECT_TYPE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  DEPLOYMENT_PLATFORM_OPTIONS,
  PAYMENT_MODE_OPTIONS,
  PAYMENT_TERM_STATUS_OPTIONS,
  type ProjectType,
  type ProjectStatus,
  type DeploymentPlatform,
  type PaymentMode,
  type PaymentTermStatus,
  type CreateProjectPayload,
  fromISO,
  toISO,
} from "./types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TermRow {
  id:           number;
  term_number:  number;
  amount:       string;
  due_date:     string;
  note:         string;
}

interface MaintTermRow {
  id:           number;
  term_number:  number;
  amount:       string;
  start_date:   string;
  end_date:     string;
  due_date:     string;
  paid_date:    string;
  payment_mode: PaymentMode | "";
  status:       PaymentTermStatus | "";
  note:         string;
}

interface FormState {
  client_name:                string;
  client_mobile:              string;
  client_alternative_mobile:  string;
  client_email:               string;
  project_name:               string;
  project_type:               ProjectType | "";
  project_description:        string;
  project_status:             ProjectStatus | "";
  is_lead_converted:          boolean;
  lead_converted_date:        string;
  project_github_link:        string;
  frontend_deploy_on:         DeploymentPlatform | "";
  frontend_deploy_url:        string;
  backend_deploy_on:          DeploymentPlatform | "";
  backend_deploy_url:         string;
  is_maintenance_mode:        boolean;
  maintenance_start_date:     string;
  maintenance_end_date:       string;
  payment_total_amount:       string;
  terms:                      TermRow[];
  maintenance_total_amount:   string;
  maint_terms:                MaintTermRow[];
}

type Errors = Partial<Record<string, string>>;

const EMPTY_FORM: FormState = {
  client_name:               "",
  client_mobile:             "",
  client_alternative_mobile: "",
  client_email:              "",
  project_name:              "",
  project_type:              "",
  project_description:       "",
  project_status:            "lead",
  is_lead_converted:         false,
  lead_converted_date:       "",
  project_github_link:       "",
  frontend_deploy_on:        "",
  frontend_deploy_url:       "",
  backend_deploy_on:         "",
  backend_deploy_url:        "",
  is_maintenance_mode:       false,
  maintenance_start_date:    "",
  maintenance_end_date:      "",
  payment_total_amount:      "",
  terms:                     [],
  maintenance_total_amount:  "",
  maint_terms:               [],
};

// ── Shared styling ─────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background:   "var(--sc-card)",
  border:       "1px solid var(--fi-border)",
  borderRadius: 10,
  padding:      "14px 16px",
  marginBottom: 10,
};

const sectionHeaderStyle: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  justifyContent: "space-between",
  width:          "100%",
  background:     "none",
  border:         "none",
  padding:        "0 0 12px",
  cursor:         "pointer",
  textAlign:      "left",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    700,
  color:         "var(--fi-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  margin:        0,
};

const YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

// ── Build payload ──────────────────────────────────────────────────────────────

function buildPayload(form: FormState): CreateProjectPayload {
  const payload: CreateProjectPayload = {
    client_name:          form.client_name.trim(),
    client_mobile:        form.client_mobile.trim(),
    project_name:         form.project_name.trim(),
    project_type:         form.project_type as ProjectType,
    payment_total_amount: Number(form.payment_total_amount),
  };
  if (form.client_alternative_mobile.trim()) payload.client_alternative_mobile = form.client_alternative_mobile.trim();
  if (form.client_email.trim())              payload.client_email               = form.client_email.trim();
  if (form.project_description.trim())       payload.project_description        = form.project_description.trim();
  if (form.project_status)                   payload.project_status             = form.project_status as ProjectStatus;
  payload.is_lead_converted = form.is_lead_converted;
  if (form.is_lead_converted && form.lead_converted_date) payload.lead_converted_date = toISO(form.lead_converted_date);
  if (form.project_github_link.trim())       payload.project_github_link        = form.project_github_link.trim();
  if (form.frontend_deploy_on)               payload.frontend_deploy_on         = form.frontend_deploy_on as DeploymentPlatform;
  if (form.frontend_deploy_url.trim())       payload.frontend_deploy_url        = form.frontend_deploy_url.trim();
  if (form.backend_deploy_on)                payload.backend_deploy_on          = form.backend_deploy_on as DeploymentPlatform;
  if (form.backend_deploy_url.trim())        payload.backend_deploy_url         = form.backend_deploy_url.trim();
  payload.is_maintenance_mode = form.is_maintenance_mode;
  if (form.is_maintenance_mode) {
    if (form.maintenance_start_date) payload.maintenance_start_date = toISO(form.maintenance_start_date);
    if (form.maintenance_end_date)   payload.maintenance_end_date   = toISO(form.maintenance_end_date);
  }
  if (form.terms.length > 0) {
    payload.payment_terms = form.terms.map((t) => ({
      term_number: t.term_number,
      amount:      Number(t.amount),
      due_date:    toISO(t.due_date) ?? undefined,
      note:        t.note.trim() || undefined,
    }));
  }
  if (form.maintenance_total_amount) {
    payload.maintenance_total_amount = Number(form.maintenance_total_amount);
  }
  if (form.maint_terms.length > 0) {
    payload.maintenance_terms = form.maint_terms.map((t) => ({
      term_number:  t.term_number,
      amount:       Number(t.amount),
      start_date:   toISO(t.start_date)   ?? undefined,
      end_date:     toISO(t.end_date)     ?? undefined,
      due_date:     toISO(t.due_date)     ?? undefined,
      paid_date:    toISO(t.paid_date)    ?? undefined,
      payment_mode: (t.payment_mode || undefined) as PaymentMode | undefined,
      status:       (t.status       || undefined) as PaymentTermStatus | undefined,
      note:         t.note.trim()   || undefined,
    }));
  }
  return payload;
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validate(form: FormState): Errors {
  const errs: Errors = {};
  if (!form.client_name.trim())   errs.client_name         = "Required";
  if (!form.client_mobile.trim()) errs.client_mobile       = "Required";
  if (!form.project_name.trim())  errs.project_name        = "Required";
  if (!form.project_type)         errs.project_type        = "Required";
  if (!form.payment_total_amount || isNaN(Number(form.payment_total_amount)) || Number(form.payment_total_amount) <= 0)
    errs.payment_total_amount = "Required";
  form.terms.forEach((t, i) => {
    if (!t.amount || isNaN(Number(t.amount)) || Number(t.amount) <= 0)
      errs[`term_amount_${i}`] = "Required";
  });
  if (form.maintenance_total_amount && (isNaN(Number(form.maintenance_total_amount)) || Number(form.maintenance_total_amount) < 0))
    errs.maintenance_total_amount = "Invalid amount";
  form.maint_terms.forEach((t, i) => {
    if (!t.amount || isNaN(Number(t.amount)) || Number(t.amount) <= 0)
      errs[`maint_amount_${i}`] = "Required";
  });
  return errs;
}

// ── Component ──────────────────────────────────────────────────────────────────

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [form,    setForm]    = useState<FormState>(EMPTY_FORM);
  const [errors,  setErrors]  = useState<Errors>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const toggleSection = (n: number) =>
    setCollapsedSections((prev) => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

  // Set TopBar title on mount, clear on unmount
  useEffect(() => {
    dispatch(setPageTitle({
      title:    isEdit ? "Edit Project" : "New Project",
      backPath: isEdit && id ? `/projects/${id}` : "/projects",
    }));
    return () => { dispatch(clearPageTitle()); };
  }, [dispatch, isEdit, id]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProject(id);
        const p   = res.data;
        setForm({
          client_name:               p.client_name,
          client_mobile:             p.client_mobile,
          client_alternative_mobile: p.client_alternative_mobile ?? "",
          client_email:              p.client_email ?? "",
          project_name:              p.project_name,
          project_type:              p.project_type,
          project_description:       p.project_description ?? "",
          project_status:            p.project_status,
          is_lead_converted:         p.is_lead_converted,
          lead_converted_date:       fromISO(p.lead_converted_date),
          project_github_link:       p.project_github_link ?? "",
          frontend_deploy_on:        p.frontend_deploy_on ?? "",
          frontend_deploy_url:       p.frontend_deploy_url ?? "",
          backend_deploy_on:         p.backend_deploy_on ?? "",
          backend_deploy_url:        p.backend_deploy_url ?? "",
          is_maintenance_mode:       p.is_maintenance_mode,
          maintenance_start_date:    fromISO(p.maintenance_start_date),
          maintenance_end_date:      fromISO(p.maintenance_end_date),
          payment_total_amount:      String(p.payment_total_amount),
          terms: p.payment_terms.map((t, i) => ({
            id:          i,
            term_number: t.term_number,
            amount:      String(t.amount),
            due_date:    fromISO(t.due_date),
            note:        t.note ?? "",
          })),
          maintenance_total_amount: p.maintenance_total_amount ? String(p.maintenance_total_amount) : "",
          maint_terms: (p.maintenance_terms ?? []).map((t, i) => ({
            id:           i,
            term_number:  t.term_number,
            amount:       String(t.amount),
            start_date:   fromISO(t.start_date),
            end_date:     fromISO(t.end_date),
            due_date:     fromISO(t.due_date),
            paid_date:    fromISO(t.paid_date),
            payment_mode: (t.payment_mode ?? "") as PaymentMode | "",
            status:       (t.status ?? "")       as PaymentTermStatus | "",
            note:         t.note ?? "",
          })),
        });
        requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
      } catch {
        if (!cancelled) showToastnew.error("Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val })), []);

  const addTerm = () => {
    const nextNum = form.terms.length > 0
      ? Math.max(...form.terms.map((t) => t.term_number)) + 1 : 1;
    setForm((f) => ({
      ...f,
      terms: [...f.terms, { id: Date.now(), term_number: nextNum, amount: "", due_date: "", note: "" }],
    }));
  };

  const removeTerm = (tid: number) =>
    setForm((f) => ({
      ...f,
      terms: f.terms.filter((t) => t.id !== tid).map((t, i) => ({ ...t, term_number: i + 1 })),
    }));

  const setTerm = (tid: number, field: keyof Omit<TermRow, "id" | "term_number">, val: string) =>
    setForm((f) => ({ ...f, terms: f.terms.map((t) => t.id === tid ? { ...t, [field]: val } : t) }));

  const addMaintTerm = () => {
    const nextNum = form.maint_terms.length > 0
      ? Math.max(...form.maint_terms.map((t) => t.term_number)) + 1 : 1;
    setForm((f) => ({
      ...f,
      maint_terms: [...f.maint_terms, {
        id: Date.now(), term_number: nextNum,
        amount: "", start_date: "", end_date: "", due_date: "",
        paid_date: "", payment_mode: "", status: "", note: "",
      }],
    }));
  };

  const removeMaintTerm = (tid: number) =>
    setForm((f) => ({
      ...f,
      maint_terms: f.maint_terms.filter((t) => t.id !== tid).map((t, i) => ({ ...t, term_number: i + 1 })),
    }));

  const setMaintTerm = (tid: number, field: keyof Omit<MaintTermRow, "id" | "term_number">, val: string) =>
    setForm((f) => ({ ...f, maint_terms: f.maint_terms.map((t) => t.id === tid ? { ...t, [field]: val } : t) }));

  const handleSubmit = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToastnew.error("Please fix the errors before submitting");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit && id) {
        const res = await updateProject(id, payload);
        showToastnew.success(res.message || "Project updated");
        navigate(`/projects/${id}`);
      } else {
        const res = await createProject(payload);
        showToastnew.success(res.message || "Project created");
        navigate(`/projects/${res.data._id}`);
      }
    } catch (err: any) {
      const apiErrors: string[] = err?.response?.data?.errors ?? [];
      if (apiErrors.length > 0) apiErrors.forEach((e: string) => showToastnew.error(e));
      else showToastnew.error(err?.response?.data?.message || err?.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const termsTotal       = form.terms.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const projectTotal     = Number(form.payment_total_amount) || 0;
  const totalMismatch    = form.terms.length > 0 && termsTotal !== projectTotal;

  const maintTermsTotal  = form.maint_terms.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const maintTotal       = Number(form.maintenance_total_amount) || 0;
  const maintMismatch    = form.maint_terms.length > 0 && maintTotal > 0 && maintTermsTotal !== maintTotal;

  const goBack = () => navigate(isEdit && id ? `/projects/${id}` : "/projects");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fi-muted)", fontSize: 14 }}>
        Loading project…
      </div>
    );
  }

  return (
    // ── Full-screen flex column — scrollable body | fixed footer ──────────
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--sc-card)" }}>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }} className="sc-scrollbar">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Section 1 — Client Info */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(1)}>
              <span style={sectionTitleStyle}>1 — Client Info</span>
              <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsedSections.has(1) ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </button>
            {!collapsedSections.has(1) && (
              <div className="pf-g4">
                <CleanInput label="Client Name" required value={form.client_name}
                  onChange={(e) => set("client_name", e.target.value)}
                  placeholder="Rahul Sharma" error={errors.client_name} />
                <CleanInput label="Mobile" required value={form.client_mobile}
                  onChange={(e) => set("client_mobile", e.target.value)}
                  placeholder="9876543210" error={errors.client_mobile} />
                <CleanInput label="Alt. Mobile" value={form.client_alternative_mobile}
                  onChange={(e) => set("client_alternative_mobile", e.target.value)}
                  placeholder="9123456780" />
                <CleanInput label="Email" type="email" value={form.client_email}
                  onChange={(e) => set("client_email", e.target.value)}
                  placeholder="client@example.com" />
              </div>
            )}
          </div>

          {/* Section 2 — Project Details */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(2)}>
              <span style={sectionTitleStyle}>2 — Project Details</span>
              <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsedSections.has(2) ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </button>
            {!collapsedSections.has(2) && (
              <>
                <div className="pf-g4" style={{ marginBottom: 10 }}>
                  <CleanInput label="Project Name" required value={form.project_name}
                    onChange={(e) => set("project_name", e.target.value)}
                    placeholder="Salon CRM" error={errors.project_name} />
                  <CleanSelect label="Project Type" required value={form.project_type}
                    onChange={(e) => set("project_type", e.target.value as ProjectType)}
                    options={PROJECT_TYPE_OPTIONS as unknown as { value: string; label: string }[]}
                    placeholder="Select type" error={errors.project_type} />
                  <CleanSelect label="Project Status" value={form.project_status}
                    onChange={(e) => set("project_status", e.target.value as ProjectStatus)}
                    options={PROJECT_STATUS_OPTIONS as unknown as { value: string; label: string }[]}
                    placeholder="Select status" />
                  <CleanSelect label="Lead Converted"
                    value={form.is_lead_converted ? "yes" : "no"}
                    onChange={(e) => set("is_lead_converted", e.target.value === "yes")}
                    options={YES_NO} />
                </div>
                {form.is_lead_converted && (
                  <div style={{ marginBottom: 10 }}>
                    <CleanInput type="date" label="Lead Converted Date" value={form.lead_converted_date}
                      onChange={(e) => set("lead_converted_date", e.target.value)}
                      style={{ maxWidth: 220 }} />
                  </div>
                )}
                <CleanTextarea label="Description" rows={2} value={form.project_description}
                  onChange={(e) => set("project_description", e.target.value)}
                  placeholder="Brief description of the project scope…" />
              </>
            )}
          </div>

          {/* Section 3 — Deployment */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(3)}>
              <span style={sectionTitleStyle}>3 — Deployment</span>
              <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsedSections.has(3) ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </button>
            {!collapsedSections.has(3) && (
              <div className="pf-g2">
                <CleanSelect label="Frontend Platform" value={form.frontend_deploy_on}
                  onChange={(e) => set("frontend_deploy_on", e.target.value as DeploymentPlatform)}
                  options={DEPLOYMENT_PLATFORM_OPTIONS as unknown as { value: string; label: string }[]}
                  placeholder="Select platform" />
                <CleanInput label="Frontend URL" type="url" value={form.frontend_deploy_url}
                  onChange={(e) => set("frontend_deploy_url", e.target.value)}
                  placeholder="https://myapp.vercel.app" />
                <CleanSelect label="Backend Platform" value={form.backend_deploy_on}
                  onChange={(e) => set("backend_deploy_on", e.target.value as DeploymentPlatform)}
                  options={DEPLOYMENT_PLATFORM_OPTIONS as unknown as { value: string; label: string }[]}
                  placeholder="Select platform" />
                <CleanInput label="Backend URL" type="url" value={form.backend_deploy_url}
                  onChange={(e) => set("backend_deploy_url", e.target.value)}
                  placeholder="https://api.myapp.in" />
                <CleanInput label="GitHub Link" type="url" value={form.project_github_link}
                  onChange={(e) => set("project_github_link", e.target.value)}
                  placeholder="https://github.com/org/repo" />
                <CleanSelect label="Maintenance Mode"
                  value={form.is_maintenance_mode ? "yes" : "no"}
                  onChange={(e) => set("is_maintenance_mode", e.target.value === "yes")}
                  options={YES_NO} />
                {form.is_maintenance_mode && (
                  <>
                    <CleanInput type="date" label="Maint. Start" value={form.maintenance_start_date}
                      onChange={(e) => set("maintenance_start_date", e.target.value)} />
                    <CleanInput type="date" label="Maint. End" value={form.maintenance_end_date}
                      onChange={(e) => set("maintenance_end_date", e.target.value)} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section 4 — Billing */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(4)}>
              <span style={sectionTitleStyle}>4 — Billing</span>
              <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsedSections.has(4) ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </button>
            {!collapsedSections.has(4) && <><div className="pf-g4" style={{ marginBottom: 12 }}>
              <CleanInput label="Total Project Amount (₹)" type="number" required
                value={form.payment_total_amount}
                onChange={(e) => set("payment_total_amount", e.target.value)}
                placeholder="e.g. 20000" error={errors.payment_total_amount} min={1} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Payment Terms ({form.terms.length})
              </span>
              <CleanButton variant="outline" size="xs" iconLeft={<Plus style={{ width: 11, height: 11 }} />} onClick={addTerm}>
                Add Term
              </CleanButton>
            </div>

            {form.terms.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--fi-muted)", margin: "4px 0 0" }}>
                No terms added. Click "Add Term" to define installments.
              </p>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--fi-border)" }}>
                        {["#", "Amount (₹)", "Due Date", "Note", ""].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "4px 6px", fontSize: 10, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.terms.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid var(--fi-border)" }}>
                          <td style={{ padding: "4px 6px", color: "var(--fi-muted)", fontWeight: 600, width: 30 }}>{t.term_number}</td>
                          <td style={{ padding: "4px 6px", width: 130 }}>
                            <CleanInput type="number" value={t.amount}
                              onChange={(e) => setTerm(t.id, "amount", e.target.value)}
                              placeholder="5000" error={errors[`term_amount_${i}`]} min={1} />
                          </td>
                          <td style={{ padding: "4px 6px", width: 150 }}>
                            <CleanInput type="date" value={t.due_date}
                              onChange={(e) => setTerm(t.id, "due_date", e.target.value)} />
                          </td>
                          <td style={{ padding: "4px 6px" }}>
                            <CleanInput type="text" value={t.note}
                              onChange={(e) => setTerm(t.id, "note", e.target.value)}
                              placeholder="e.g. Advance" />
                          </td>
                          <td style={{ padding: "4px 6px", width: 32 }}>
                            <CleanButton variant="danger" size="xs"
                              icon={<Trash2 style={{ width: 15, height: 15 }} />}
                              onClick={() => removeTerm(t.id)} title="Remove"
                              style={{ height: "var(--fi-height)", width: "var(--fi-height)" }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{
                  marginTop: 10, padding: "6px 10px", borderRadius: 6,
                  background: totalMismatch ? "rgba(239,68,68,0.07)" : "var(--sc-surface)",
                  border: `1px solid ${totalMismatch ? "rgba(239,68,68,0.3)" : "var(--fi-border)"}`,
                }}>
                  <span style={{ fontSize: 12, color: totalMismatch ? "#ef4444" : "#ffffff" }}>
                    Terms: <strong>₹{termsTotal.toLocaleString("en-IN")}</strong>
                    {" / "}
                    Total: <strong>₹{projectTotal.toLocaleString("en-IN")}</strong>
                    {totalMismatch && "  ⚠ Totals don't match"}
                  </span>
                </div>
              </>
            )}
            </>}
          </div>

          {/* Section 5 — Maintenance Billing */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(5)}>
              <span style={sectionTitleStyle}>5 — Maintenance Billing</span>
              <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsedSections.has(5) ? "rotate(-90deg)" : "rotate(0deg)" }} />
            </button>
            {!collapsedSections.has(5) && (
              <>
                <div className="pf-g4" style={{ marginBottom: 12 }}>
                  <CleanInput
                    label="Total Maintenance Amount (₹)"
                    type="number"
                    value={form.maintenance_total_amount}
                    onChange={(e) => set("maintenance_total_amount", e.target.value)}
                    placeholder="e.g. 10000"
                    error={errors.maintenance_total_amount}
                    min={0}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Maintenance Terms ({form.maint_terms.length})
                  </span>
                  <CleanButton variant="outline" size="xs" iconLeft={<Plus style={{ width: 11, height: 11 }} />} onClick={addMaintTerm}>
                    Add Term
                  </CleanButton>
                </div>

                {form.maint_terms.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--fi-muted)", margin: "4px 0 0" }}>
                    No maintenance terms. Click "Add Term" to define installments.
                  </p>
                ) : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--fi-border)" }}>
                            {["#", "Amount (₹)", "Start", "End", "Due", "Paid Date", "Mode", "Status", "Note", ""].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "4px 6px", fontSize: 10, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {form.maint_terms.map((t, i) => (
                            <tr key={t.id} style={{ borderBottom: "1px solid var(--fi-border)" }}>
                              <td style={{ padding: "4px 6px", color: "var(--fi-muted)", fontWeight: 600, width: 28 }}>{t.term_number}</td>
                              <td style={{ padding: "4px 6px", width: 120 }}>
                                <CleanInput type="number" value={t.amount}
                                  onChange={(e) => setMaintTerm(t.id, "amount", e.target.value)}
                                  placeholder="2000" error={errors[`maint_amount_${i}`]} min={1} />
                              </td>
                              <td style={{ padding: "4px 6px", width: 140 }}>
                                <CleanInput type="date" value={t.start_date}
                                  onChange={(e) => setMaintTerm(t.id, "start_date", e.target.value)} />
                              </td>
                              <td style={{ padding: "4px 6px", width: 140 }}>
                                <CleanInput type="date" value={t.end_date}
                                  onChange={(e) => setMaintTerm(t.id, "end_date", e.target.value)} />
                              </td>
                              <td style={{ padding: "4px 6px", width: 140 }}>
                                <CleanInput type="date" value={t.due_date}
                                  onChange={(e) => setMaintTerm(t.id, "due_date", e.target.value)} />
                              </td>
                              <td style={{ padding: "4px 6px", width: 140 }}>
                                <CleanInput type="date" value={t.paid_date}
                                  onChange={(e) => setMaintTerm(t.id, "paid_date", e.target.value)} />
                              </td>
                              <td style={{ padding: "4px 6px", width: 130 }}>
                                <CleanSelect
                                  value={t.payment_mode}
                                  onChange={(e) => setMaintTerm(t.id, "payment_mode", e.target.value)}
                                  options={PAYMENT_MODE_OPTIONS as unknown as { value: string; label: string }[]}
                                  placeholder="Mode" />
                              </td>
                              <td style={{ padding: "4px 6px", width: 120 }}>
                                <CleanSelect
                                  value={t.status}
                                  onChange={(e) => setMaintTerm(t.id, "status", e.target.value)}
                                  options={PAYMENT_TERM_STATUS_OPTIONS as unknown as { value: string; label: string }[]}
                                  placeholder="Status" />
                              </td>
                              <td style={{ padding: "4px 6px" }}>
                                <CleanInput type="text" value={t.note}
                                  onChange={(e) => setMaintTerm(t.id, "note", e.target.value)}
                                  placeholder="e.g. Q1 2026" />
                              </td>
                              <td style={{ padding: "4px 6px", width: 32 }}>
                                <CleanButton variant="danger" size="xs"
                                  icon={<Trash2 style={{ width: 15, height: 15 }} />}
                                  onClick={() => removeMaintTerm(t.id)} title="Remove"
                                  style={{ height: "var(--fi-height)", width: "var(--fi-height)" }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {form.maint_terms.length > 0 && (
                      <div style={{
                        marginTop: 10, padding: "6px 10px", borderRadius: 6,
                        background: maintMismatch ? "rgba(239,68,68,0.07)" : "var(--sc-surface)",
                        border: `1px solid ${maintMismatch ? "rgba(239,68,68,0.3)" : "var(--fi-border)"}`,
                      }}>
                        <span style={{ fontSize: 12, color: maintMismatch ? "#ef4444" : "#ffffff" }}>
                          Terms: <strong>₹{maintTermsTotal.toLocaleString("en-IN")}</strong>
                          {maintTotal > 0 && <>{" / "}Total: <strong>₹{maintTotal.toLocaleString("en-IN")}</strong></>}
                          {maintMismatch && "  ⚠ Totals don't match"}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Fixed footer ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
        padding: "10px 16px",
        borderTop: "1px solid var(--sb-border)",
        background: "var(--sb-bg)",
        flexShrink: 0,
      }}>
        <CleanButton variant="outline" size="sm" onClick={goBack} disabled={saving}>
          Cancel
        </CleanButton>
        <CleanButton variant="primary" size="sm" onClick={handleSubmit} loading={saving}>
          {isEdit ? "Save Changes" : "Create Project"}
        </CleanButton>
      </div>

    </div>
  );
};

export default ProjectForm;
