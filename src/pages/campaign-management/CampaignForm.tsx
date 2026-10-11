import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, ChevronDown, CheckCircle2, XCircle, Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import { setPageTitle, clearPageTitle } from "../../store/slices/pageTitleSlice";
import {
  CleanButton,
  CleanInput,
  CleanSelect,
  CleanTextarea,
  CleanModal,
} from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { emitNavDone } from "../../atoms/NavigationProgress";
import {
  checkSlug,
  createCampaign,
  fetchCampaign,
  fetchIndustryTypes,
  updateCampaign,
} from "../../services/campaignApi";
import { ShortLinkCard } from "./ShortLinkCard";
import { InfoTip, LabelWithTip } from "./InfoTip";
import { useIsMobile } from "./useIsMobile";
import {
  type Campaign,
  type CampaignPayload,
  type CustomParam,
  type Option,
  type UtmParams,
  MAX_CUSTOM_PARAMS,
  SHORT_LINK_DOMAIN,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  buildPreviewUrl,
  fromLocalInput,
  toLocalInput,
} from "./types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ParamRow extends CustomParam {
  id: number;
}

interface FormState {
  name:            string;
  description:     string;
  industry_type:   string;
  tags:            string;
  destination_url: string;
  utm:             Required<UtmParams>;
  custom_params:   ParamRow[];
  slug:            string;
  status:          "active" | "paused";
  start_date:      string;   // datetime-local value
  expires_at:      string;   // datetime-local value
  fallback_url:    string;
}

type Errors = Partial<Record<string, string>>;

/** 409 → errors: { slug, suggestions } · 400 → errors: string[] (validation) or { slug, suggestions } */
interface SubmitError {
  message: string;
  errors?: string[] | { slug?: string; suggestions?: string[] };
}

type SlugState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; reason: string; suggestions: string[] };

const EMPTY_UTM: Required<UtmParams> = {
  utm_source: "", utm_medium: "", utm_campaign: "",
  utm_term: "", utm_content: "", utm_id: "", utm_source_platform: "",
};

const EMPTY_FORM: FormState = {
  name:            "",
  description:     "",
  industry_type:   "",
  tags:            "",
  destination_url: "",
  utm:             EMPTY_UTM,
  custom_params:   [],
  slug:            "",
  status:          "active",
  start_date:      "",
  expires_at:      "",
  fallback_url:    "",
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active — link redirects" },
  { value: "paused", label: "Paused — link goes to fallback" },
];

const UTM_FIELDS: { key: keyof UtmParams; label: string; placeholder: string; required?: boolean }[] = [
  { key: "utm_source",          label: "UTM Source",          placeholder: "instagram",        required: true },
  { key: "utm_medium",          label: "UTM Medium",          placeholder: "social",           required: true },
  { key: "utm_campaign",        label: "UTM Campaign",        placeholder: "diwali_sale_2026", required: true },
  { key: "utm_term",            label: "UTM Term",            placeholder: "iphone+17" },
  { key: "utm_content",         label: "UTM Content",         placeholder: "story_ad_v2" },
  { key: "utm_id",              label: "UTM ID",              placeholder: "cmp_123" },
  { key: "utm_source_platform", label: "UTM Source Platform", placeholder: "meta_ads" },
];

const UTM_KEYS       = new Set(UTM_FIELDS.map((f) => f.key as string));
const UTM_VALUE_RE   = /^[^\s&=#?]+$/;
const PARAM_KEY_RE   = /^[a-zA-Z0-9_\-.]+$/;
const SLUG_RE        = /^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/;
const HTTP_URL_RE    = /^https?:\/\/.+/i;

// ── Shared styling (same look as ProjectForm) ──────────────────────────────────

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

const hintStyle: React.CSSProperties = { fontSize: 11, color: "var(--fi-muted)", margin: "6px 0 0" };

// ── Payload / validation ───────────────────────────────────────────────────────

const cleanCustomParams = (rows: ParamRow[]): CustomParam[] =>
  rows
    .filter((r) => r.key.trim() || r.value.trim())
    .map((r) => ({ key: r.key.trim(), value: r.value.trim() }));

function buildPayload(form: FormState, isEdit: boolean): CampaignPayload {
  const utm: UtmParams = {
    utm_source:   form.utm.utm_source.trim(),
    utm_medium:   form.utm.utm_medium.trim(),
    utm_campaign: form.utm.utm_campaign.trim(),
  };
  (["utm_term", "utm_content", "utm_id", "utm_source_platform"] as const).forEach((k) => {
    const v = form.utm[k].trim();
    if (v) utm[k] = v;
  });

  const payload: CampaignPayload = {
    name:            form.name.trim(),
    industry_type:   form.industry_type,
    destination_url: form.destination_url.trim(),
    utm,
    custom_params:   cleanCustomParams(form.custom_params),
    tags:            form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    status:          form.status,
  };

  const description = form.description.trim();
  const slug        = form.slug.trim();
  const fallback    = form.fallback_url.trim();
  const start       = fromLocalInput(form.start_date);
  const expires     = fromLocalInput(form.expires_at);

  if (isEdit) {
    // PATCH: send empty values as null/"" so the user can clear them
    payload.description  = description;
    if (slug) payload.slug = slug;
    payload.start_date   = start;
    payload.expires_at   = expires;
    payload.fallback_url = fallback || null;
  } else {
    // POST: omit empty optionals — slug omitted → server generates a random 6-char name
    if (description) payload.description  = description;
    if (slug)        payload.slug         = slug;
    if (start)       payload.start_date   = start;
    if (expires)     payload.expires_at   = expires;
    if (fallback)    payload.fallback_url = fallback;
  }
  return payload;
}

function validate(form: FormState): Errors {
  const errs: Errors = {};
  const name = form.name.trim();
  if (!name)                     errs.name = "Required";
  else if (name.length < 2)      errs.name = "At least 2 characters";
  if (!form.industry_type)       errs.industry_type = "Required";

  const dest = form.destination_url.trim();
  if (!dest)                          errs.destination_url = "Required";
  else if (!HTTP_URL_RE.test(dest))   errs.destination_url = "Must start with http:// or https://";
  else { try { new URL(dest); } catch { errs.destination_url = "Not a valid URL"; } }

  UTM_FIELDS.forEach(({ key, required }) => {
    const v = form.utm[key].trim();
    if (!v) { if (required) errs[key] = "Required"; return; }
    if (!UTM_VALUE_RE.test(v)) errs[key] = "No spaces or & = # ? characters";
  });

  const seen = new Set<string>();
  form.custom_params.forEach((p, i) => {
    const k = p.key.trim();
    const v = p.value.trim();
    if (!k && !v) return;
    if (!k)                          errs[`param_key_${i}`]   = "Required";
    else if (!PARAM_KEY_RE.test(k))  errs[`param_key_${i}`]   = "Letters, numbers, _ - . only";
    else if (UTM_KEYS.has(k))        errs[`param_key_${i}`]   = "Use the UTM fields above";
    else if (seen.has(k))            errs[`param_key_${i}`]   = "Duplicate key";
    if (!v)                          errs[`param_value_${i}`] = "Required";
    else if (!UTM_VALUE_RE.test(v))  errs[`param_value_${i}`] = "No spaces or & = # ?";
    seen.add(k);
  });

  const slug = form.slug.trim();
  if (slug) {
    if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH)
      errs.slug = `${SLUG_MIN_LENGTH}-${SLUG_MAX_LENGTH} characters`;
    else if (!SLUG_RE.test(slug))
      errs.slug = "Lowercase letters, numbers and single hyphens only";
  }

  if (form.start_date && form.expires_at && new Date(form.expires_at) <= new Date(form.start_date))
    errs.expires_at = "Must be after the start date";

  const fallback = form.fallback_url.trim();
  if (fallback && !HTTP_URL_RE.test(fallback)) errs.fallback_url = "Must start with http:// or https://";

  return errs;
}

// ── Component ──────────────────────────────────────────────────────────────────

const CampaignForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobile = useIsMobile();

  const [form,       setForm]       = useState<FormState>(EMPTY_FORM);
  const [errors,     setErrors]     = useState<Errors>({});
  const [loading,    setLoading]    = useState(isEdit);
  const [saving,     setSaving]     = useState(false);
  const [industries, setIndustries] = useState<Option[]>([]);
  const [slugState,  setSlugState]  = useState<SlugState>({ status: "idle" });
  const [original,   setOriginal]   = useState<Campaign | null>(null);
  const [created,    setCreated]    = useState<Campaign | null>(null);
  const [collapsed,  setCollapsed]  = useState<Set<number>>(new Set());

  const slugSectionRef = useRef<HTMLDivElement>(null);

  const toggleSection = (n: number) =>
    setCollapsed((prev) => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n); else s.add(n);
      return s;
    });

  useEffect(() => {
    dispatch(setPageTitle({
      title:    isEdit ? "Edit Campaign" : "New Campaign",
      backPath: isEdit && id ? `/campaigns/${id}` : "/campaigns",
    }));
    return () => { dispatch(clearPageTitle()); };
  }, [dispatch, isEdit, id]);

  // Industry dropdown — loaded once
  useEffect(() => {
    fetchIndustryTypes()
      .then(setIndustries)
      .catch(() => showToastnew.error("Failed to load industry types"));
  }, []);

  // Edit mode — load the campaign
  useEffect(() => {
    if (!isEdit || !id) {
      requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const c = await fetchCampaign(id);
        if (cancelled) return;
        setOriginal(c);
        setForm({
          name:            c.name,
          description:     c.description ?? "",
          industry_type:   c.industry_type,
          tags:            (c.tags ?? []).join(", "),
          destination_url: c.destination_url,
          utm:             { ...EMPTY_UTM, ...c.utm },
          custom_params:   (c.custom_params ?? []).map((p, i) => ({ ...p, id: i })),
          slug:            c.slug,
          status:          c.status === "paused" ? "paused" : "active",
          start_date:      toLocalInput(c.start_date),
          expires_at:      toLocalInput(c.expires_at),
          fallback_url:    c.fallback_url ?? "",
        });
        requestAnimationFrame(() => requestAnimationFrame(() => emitNavDone()));
      } catch {
        if (!cancelled) showToastnew.error("Failed to load campaign");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // Live slug availability check (debounced 400ms, stale requests aborted)
  useEffect(() => {
    const slug = form.slug.trim();
    if (slug.length < SLUG_MIN_LENGTH || (original && slug === original.slug)) {
      setSlugState({ status: "idle" });
      return;
    }
    setSlugState({ status: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await checkSlug(slug, id, controller.signal);
        setSlugState(res.available
          ? { status: "available" }
          : { status: "unavailable", reason: res.reason ?? "Not available", suggestions: res.suggestions ?? [] });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setSlugState({ status: "idle" });
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.slug, id, original]);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => (e[key as string] ? { ...e, [key]: undefined } : e));
  }, []);

  // GA convention: spaces in UTM values become underscores
  const setUtm = (key: keyof UtmParams, val: string) => {
    setForm((f) => ({ ...f, utm: { ...f.utm, [key]: val.replace(/\s+/g, "_") } }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // Lower-case as the user types; spaces become hyphens (slugs are DNS labels)
  const setSlug = (val: string) => set("slug", val.toLowerCase().replace(/\s+/g, "-"));

  const addParam = () =>
    setForm((f) => ({ ...f, custom_params: [...f.custom_params, { id: Date.now(), key: "", value: "" }] }));

  const removeParam = (pid: number) =>
    setForm((f) => ({ ...f, custom_params: f.custom_params.filter((p) => p.id !== pid) }));

  const setParam = (pid: number, field: "key" | "value", val: string) =>
    setForm((f) => ({
      ...f,
      custom_params: f.custom_params.map((p) => (p.id === pid ? { ...p, [field]: val.replace(/\s+/g, "_") } : p)),
    }));

  const previewUrl = useMemo(
    () => buildPreviewUrl(form.destination_url, form.utm, cleanCustomParams(form.custom_params)),
    [form.destination_url, form.utm, form.custom_params],
  );

  const showSlugConflict = (reason: string, suggestions: string[]) => {
    setSlugState({ status: "unavailable", reason, suggestions });
    setCollapsed((prev) => { const s = new Set(prev); s.delete(3); return s; });
    slugSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToastnew.error("Please fix the errors before submitting");
      return;
    }
    if (slugState.status === "unavailable") {
      showToastnew.error("Please change the short URL name");
      slugSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(form, isEdit);
      if (isEdit && id) {
        const res = await updateCampaign(id, payload);
        showToastnew.success(res.message || "Campaign updated");
        navigate(`/campaigns/${id}`);
      } else {
        const res = await createCampaign(payload);
        showToastnew.success(res.message || "Campaign created");
        setCreated(res.data);
      }
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const res    = axios.isAxiosError<SubmitError>(err) ? err.response?.data : undefined;
      if (status === 409 || (status === 400 && res?.errors && !Array.isArray(res.errors))) {
        // Name taken between the live check and submit, or reserved / bad format
        const message = res?.message ?? "Short URL name is not available";
        showSlugConflict(message, (res?.errors as { suggestions?: string[] })?.suggestions ?? []);
        showToastnew.error(message);
      } else if (status === 400 && Array.isArray(res?.errors)) {
        res.errors.forEach((e) => showToastnew.error(e));
      } else {
        showToastnew.error(res?.message || (err as Error)?.message || "Something went wrong");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForAnother = () => {
    setCreated(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSlugState({ status: "idle" });
  };

  const goBack = () => navigate(isEdit && id ? `/campaigns/${id}` : "/campaigns");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fi-muted)", fontSize: 14 }}>
        Loading campaign…
      </div>
    );
  }

  if (original && !original.is_active) {
    return (
      <div style={{ textAlign: "center", padding: "64px 16px", color: "var(--fi-muted)" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--dt-text)" }}>This campaign is archived</p>
        <p style={{ fontSize: 13 }}>Archived campaigns cannot be edited.</p>
        <CleanButton variant="outline" size="sm" onClick={goBack}>Back</CleanButton>
      </div>
    );
  }

  const chevron = (n: number) => (
    <ChevronDown style={{ width: 13, height: 13, color: "var(--fi-muted)", flexShrink: 0, transition: "transform 200ms", transform: collapsed.has(n) ? "rotate(-90deg)" : "rotate(0deg)" }} />
  );

  const slugIcon =
    slugState.status === "checking"    ? <Loader2      className="animate-spin" style={{ width: 15, height: 15, color: "var(--fi-muted)" }} /> :
    slugState.status === "available"   ? <CheckCircle2 style={{ width: 15, height: 15, color: "#22c55e" }} /> :
    slugState.status === "unavailable" ? <XCircle      style={{ width: 15, height: 15, color: "#ef4444" }} /> :
    null;

  const slugChanged = isEdit && original && form.slug.trim() && form.slug.trim() !== original.slug;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--sc-card)" }}>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "10px" : "12px 16px" }} className="sc-scrollbar">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Section 1 — Campaign */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(1)}>
              <span style={sectionTitleStyle}>1 — Campaign</span>
              {chevron(1)}
            </button>
            {!collapsed.has(1) && (
              <>
                <div className="pf-g2" style={{ marginBottom: 10 }}>
                  <CleanInput label="Campaign Name" required value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="iPhone 17 Diwali Sale" error={errors.name} />
                  <CleanSelect label="Industry" required value={form.industry_type}
                    onChange={(e) => set("industry_type", e.target.value)}
                    options={industries}
                    placeholder={industries.length ? "Select industry" : "Loading…"}
                    error={errors.industry_type} />
                </div>
                <div className="pf-g2" style={{ marginBottom: 10 }}>
                  <CleanInput label="Tags" value={form.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    placeholder="diwali, iphone, festive"
                    hint="Comma separated" />
                </div>
                <CleanTextarea label="Description" rows={2} value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What is this campaign about?" />
              </>
            )}
          </div>

          {/* Section 2 — Destination & UTM */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(2)}>
              <span style={sectionTitleStyle}>2 — Destination & UTM</span>
              {chevron(2)}
            </button>
            {!collapsed.has(2) && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <CleanInput label={<LabelWithTip k="destination">Destination URL</LabelWithTip>} type="url" required value={form.destination_url}
                    onChange={(e) => set("destination_url", e.target.value)}
                    placeholder="https://www.flipkart.com/apple-iphone-17/p/itm123"
                    error={errors.destination_url} />
                </div>

                <div className="pf-g4" style={{ marginBottom: 10 }}>
                  {UTM_FIELDS.map(({ key, label, placeholder, required }) => (
                    <CleanInput key={key} label={<LabelWithTip k={key}>{label}</LabelWithTip>} required={required} value={form.utm[key]}
                      onChange={(e) => setUtm(key, e.target.value)}
                      placeholder={placeholder} error={errors[key]} />
                  ))}
                </div>

                {/* Custom params */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 8px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Custom Params ({form.custom_params.length}/{MAX_CUSTOM_PARAMS}) <InfoTip k="custom_params" />
                  </span>
                  <CleanButton variant="outline" size="xs" iconLeft={<Plus style={{ width: 11, height: 11 }} />}
                    onClick={addParam} disabled={form.custom_params.length >= MAX_CUSTOM_PARAMS}>
                    Add Param
                  </CleanButton>
                </div>
                {form.custom_params.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--fi-muted)", margin: "4px 0 0" }}>
                    Optional extra query params, e.g. ref=abc.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {form.custom_params.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <CleanInput value={p.key} placeholder="key"
                          onChange={(e) => setParam(p.id, "key", e.target.value)}
                          error={errors[`param_key_${i}`]} style={{ flex: 1 }} />
                        <CleanInput value={p.value} placeholder="value"
                          onChange={(e) => setParam(p.id, "value", e.target.value)}
                          error={errors[`param_value_${i}`]} style={{ flex: 1 }} />
                        <CleanButton variant="danger" size="xs"
                          icon={<Trash2 style={{ width: 15, height: 15 }} />}
                          onClick={() => removeParam(p.id)} title="Remove"
                          style={{ height: "var(--fi-height)", width: "var(--fi-height)", flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Live final URL preview */}
                {previewUrl && (
                  <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 6, background: "var(--sc-surface)", border: "1px solid var(--fi-border)" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      Final URL preview <InfoTip k="redirects_to" />
                    </div>
                    <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--dt-text)", wordBreak: "break-all" }}>
                      {previewUrl}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section 3 — Short Link */}
          <div style={sectionStyle} ref={slugSectionRef}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(3)}>
              <span style={sectionTitleStyle}>3 — Short Link</span>
              {chevron(3)}
            </button>
            {!collapsed.has(3) && (
              <>
                <div style={{ maxWidth: 520 }}>
                  <CleanInput
                    label={<LabelWithTip k="short_name">Short URL Name</LabelWithTip>}
                    value={form.slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="iphone17-diwali"
                    error={errors.slug}
                    autoComplete="off"
                    suffix={
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "var(--fi-muted)" }}>.{SHORT_LINK_DOMAIN}</span>
                        {slugIcon}
                      </span>
                    }
                  />
                </div>

                {slugState.status === "available" && (
                  <p style={{ ...hintStyle, color: "#22c55e" }}>
                    {form.slug.trim()}.{SHORT_LINK_DOMAIN} is available
                  </p>
                )}

                {slugState.status === "unavailable" && (
                  <div style={{ marginTop: 6 }}>
                    <p style={{ ...hintStyle, color: "#ef4444", marginTop: 0 }}>{slugState.reason}</p>
                    {slugState.suggestions.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--fi-muted)" }}>Try:</span>
                        {slugState.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSlug(s)}
                            style={{
                              padding: "3px 10px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                              border: "1px solid #6366f1", background: "rgba(99,102,241,0.08)", color: "#6366f1",
                              fontFamily: "ui-monospace, monospace",
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {slugState.status === "idle" && !form.slug.trim() && !isEdit && (
                  <p style={hintStyle}>Leave empty to get a random 6-character name.</p>
                )}

                {slugChanged && (
                  <p style={{ ...hintStyle, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle style={{ width: 13, height: 13 }} />
                    Changing the name breaks links that were already shared ({original!.slug}.{SHORT_LINK_DOMAIN}).
                  </p>
                )}
              </>
            )}
          </div>

          {/* Section 4 — Schedule & Fallback */}
          <div style={sectionStyle}>
            <button type="button" style={sectionHeaderStyle} onClick={() => toggleSection(4)}>
              <span style={sectionTitleStyle}>4 — Schedule & Fallback</span>
              {chevron(4)}
            </button>
            {!collapsed.has(4) && (
              <>
                <div className="pf-g2" style={{ marginBottom: 10 }}>
                  <CleanSelect label={<LabelWithTip k="status">Status</LabelWithTip>} value={form.status}
                    onChange={(e) => set("status", e.target.value as FormState["status"])}
                    options={STATUS_OPTIONS} />
                  <CleanInput label={<LabelWithTip k="fallback_url">Fallback URL</LabelWithTip>} type="url" value={form.fallback_url}
                    onChange={(e) => set("fallback_url", e.target.value)}
                    placeholder="https://www.flipkart.com"
                    hint="Where paused / expired / not-started links go"
                    error={errors.fallback_url} />
                  <CleanInput label={<LabelWithTip k="schedule">Start Date</LabelWithTip>} type="datetime-local" value={form.start_date}
                    onChange={(e) => set("start_date", e.target.value)} />
                  <CleanInput label="Expires At" type="datetime-local" value={form.expires_at}
                    onChange={(e) => set("expires_at", e.target.value)}
                    error={errors.expires_at} />
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Fixed footer ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10,
        padding: isMobile ? "10px 12px calc(76px + env(safe-area-inset-bottom, 0px))" : "10px 16px",
        borderTop: "1px solid var(--sb-border)",
        background: "var(--sb-bg)",
        flexShrink: 0,
      }}>
        <CleanButton variant="outline" size="sm" onClick={goBack} disabled={saving}
          style={isMobile ? { flex: 1, justifyContent: "center" } : undefined}>
          Cancel
        </CleanButton>
        <CleanButton variant="primary" size="sm" onClick={handleSubmit} loading={saving}
          disabled={slugState.status === "checking"}
          style={isMobile ? { flex: 2, justifyContent: "center" } : undefined}>
          {isEdit ? "Save Changes" : "Create Short Link"}
        </CleanButton>
      </div>

      {/* ── Result modal ─────────────────────────────────────────────────── */}
      <CleanModal
        isOpen={!!created}
        onClose={() => navigate("/campaigns")}
        title="Short link ready"
        subtitle={created ? `${created.name} · ${created.reference_id}` : undefined}
        maxWidth={620}
        mode="modal"
        expandable={false}
        footer={
          <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <CleanButton variant="outline" size="sm" onClick={resetForAnother}>Create another</CleanButton>
            <CleanButton variant="outline" size="sm" onClick={() => navigate("/campaigns")}>Back to list</CleanButton>
            <CleanButton variant="primary" size="sm" iconLeft={<BarChart3 style={{ width: 13, height: 13 }} />}
              onClick={() => created && navigate(`/campaigns/${created._id}`)}>
              View analytics
            </CleanButton>
          </div>
        }
      >
        {created && (
          <ShortLinkCard
            shortUrl={created.short_url}
            shortUrlPath={created.short_url_path}
            slug={created.slug}
            destinationUrl={created.destination_url}
            finalUrl={created.final_url}
          />
        )}
      </CleanModal>
    </div>
  );
};

export default CampaignForm;
