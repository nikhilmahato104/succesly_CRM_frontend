import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  CleanButton,
  CleanInput,
  CleanSwitch,
  CleanTextarea,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import { createSite, fetchSite, updateSite } from "../../services/siteMaintenanceApi";
import {
  type SitePayload,
  type DuplicateSiteError,
  normalizeSiteUrl,
  duplicateSiteError,
  apiErrorMessage,
} from "./types";

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  site_name:           string;
  site_url:            string;
  is_maintenance_mode: boolean;
  maintenance_message: string;
  is_active:           boolean;
}

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  site_name:           "",
  site_url:            "",
  is_maintenance_mode: false,
  maintenance_message: "",
  is_active:           true,
};

// ── Shared styling (same as ProjectForm) ───────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background:   "var(--sc-card)",
  border:       "1px solid var(--fi-border)",
  borderRadius: "var(--radius)",
  padding:      "14px 16px",
  marginBottom: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize:      11,
  fontWeight:    700,
  color:         "var(--fi-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  margin:        "0 0 12px",
};

// ── Validation / payload ───────────────────────────────────────────────────────

function validate(form: FormState): Errors {
  const errs: Errors = {};
  if (!form.site_name.trim()) errs.site_name = "Required";
  if (!form.site_url.trim())  errs.site_url  = "Required";
  else if (!normalizeSiteUrl(form.site_url)) errs.site_url = "Enter a valid http/https url, e.g. https://abc.com";
  return errs;
}

/** Create: everything. Edit: only what changed — PATCH touches only the fields sent. */
function buildPayload(form: FormState, initial: FormState | null): SitePayload {
  const full: SitePayload = {
    site_name:           form.site_name.trim(),
    site_url:            form.site_url.trim(),
    is_maintenance_mode: form.is_maintenance_mode,
    // "" resets the message to the server's default wording
    maintenance_message: form.maintenance_message.trim(),
    is_active:           form.is_active,
  };
  if (!initial) {
    if (!full.maintenance_message) delete full.maintenance_message;
    delete full.is_active;
    return full;
  }
  const before: SitePayload = {
    site_name:           initial.site_name.trim(),
    site_url:            initial.site_url.trim(),
    is_maintenance_mode: initial.is_maintenance_mode,
    maintenance_message: initial.maintenance_message.trim(),
    is_active:           initial.is_active,
  };
  return Object.fromEntries(
    Object.entries(full).filter(([k, v]) => before[k as keyof SitePayload] !== v),
  ) as SitePayload;
}

// ── Component ──────────────────────────────────────────────────────────────────

const SiteMaintenanceForm: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();

  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [initial,   setInitial]   = useState<FormState | null>(null);
  const [errors,    setErrors]    = useState<Errors>({});
  const [duplicate, setDuplicate] = useState<(DuplicateSiteError & { message: string }) | null>(null);
  const [loading,   setLoading]   = useState(isEdit);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!isEdit || !id) { requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone())); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const s = await fetchSite(id);
        if (cancelled) return;
        const loaded: FormState = {
          site_name:           s.site_name,
          site_url:            s.site_url,
          is_maintenance_mode: s.is_maintenance_mode,
          maintenance_message: s.maintenance_message ?? "",
          is_active:           s.is_active,
        };
        setForm(loaded);
        setInitial(loaded);
        setErrors({});
        setDuplicate(null);
      } catch (err) {
        if (!cancelled) showToastnew.error(apiErrorMessage(err, "Failed to load site"));
      } finally {
        if (!cancelled) {
          setLoading(false);
          requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
    if (key === "site_url") setDuplicate(null);
  }, []);

  const matchedAs = normalizeSiteUrl(form.site_url);
  const hasPath   = !!matchedAs && matchedAs.includes("/");

  const handleSubmit = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToastnew.error("Please fix the errors before submitting");
      return;
    }
    const payload = buildPayload(form, isEdit ? initial : null);
    if (isEdit && Object.keys(payload).length === 0) {
      showToastnew.success("Nothing to save");
      navigate("/site-maintenance");
      return;
    }

    setSaving(true);
    setDuplicate(null);
    try {
      const res = isEdit && id ? await updateSite(id, payload) : await createSite(payload);
      showToastnew.success(res.message || (isEdit ? "Site updated" : "Site registered"));
      navigate("/site-maintenance");
    } catch (err) {
      const dup = duplicateSiteError(err);
      if (dup) {
        setDuplicate(dup);
        setErrors(e => ({ ...e, site_url: "Already registered" }));
      } else {
        showToastnew.error(apiErrorMessage(err, isEdit ? "Failed to update site" : "Failed to register site"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fi-muted)", fontSize: 14 }}>
        Loading site…
      </div>
    );
  }

  return (
    // ── Full-screen flex column — scrollable body | fixed footer ──────────
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--sc-card)" }}>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }} className="sc-scrollbar">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Section 1 — Site */}
          <div style={sectionStyle}>
            <p style={sectionTitleStyle}>1 — Site</p>
            <div className="pf-g2">
              <CleanInput
                label="Site Name" required
                value={form.site_name}
                onChange={e => set("site_name", e.target.value)}
                placeholder="ABC Storefront"
                error={errors.site_name}
              />
              <CleanInput
                label="Site URL" required type="url"
                value={form.site_url}
                onChange={e => set("site_url", e.target.value)}
                placeholder="https://abc.com"
                error={errors.site_url}
                hint={matchedAs
                  ? `Matched as ${matchedAs}${hasPath ? " — this exact page only" : " — every page on this host"}`
                  : "Any form works: abc.com, https://abc.com, https://www.abc.com/"}
              />
            </div>

            {duplicate && (
              <div style={{
                marginTop: 12, display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                borderRadius: "var(--radius)", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)",
              }}>
                <AlertTriangle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--fi-text)", lineHeight: 1.5 }}>{duplicate.message}</p>
                  {duplicate.existing_id !== id && (
                    <CleanButton
                      variant="outline" size="xs" style={{ marginTop: 8 }}
                      onClick={() => navigate(`/site-maintenance/${duplicate.existing_id}/edit`)}
                    >
                      Edit the existing site instead
                    </CleanButton>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2 — Maintenance */}
          <div style={sectionStyle}>
            <p style={sectionTitleStyle}>2 — Maintenance</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <CleanSwitch
                checked={form.is_maintenance_mode}
                onChange={v => set("is_maintenance_mode", v)}
                onColor="#f59e0b"
                label="Maintenance mode"
                hint={form.is_maintenance_mode
                  ? "Visitors see the maintenance page on the next status check."
                  : "The site renders normally. Most sites are registered live and switched on at deploy time."}
              />
              <CleanTextarea
                label="Message visitors see"
                rows={3}
                value={form.maintenance_message}
                onChange={e => set("maintenance_message", e.target.value)}
                placeholder="We are upgrading our booking system. Back by 6 PM IST."
                hint="Leave empty to use the default wording."
              />
            </div>
          </div>

          {/* Section 3 — Record (edit only) */}
          {isEdit && (
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>3 — Record</p>
              <CleanSwitch
                checked={form.is_active}
                onChange={v => set("is_active", v)}
                label="Active record"
                hint={form.is_active
                  ? "The status check uses this record."
                  : "Retired — the status check ignores it, so the site reports as live. History is kept."}
              />
            </div>
          )}
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
        <CleanButton variant="outline" size="sm" onClick={() => navigate("/site-maintenance")} disabled={saving}>
          Cancel
        </CleanButton>
        <CleanButton variant="primary" size="sm" onClick={handleSubmit} loading={saving}>
          {isEdit ? "Save Changes" : "Register Site"}
        </CleanButton>
      </div>
    </div>
  );
};

export default SiteMaintenanceForm;
