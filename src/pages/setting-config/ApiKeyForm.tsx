import React from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { patchData } from "../../services/crmServices";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { CleanInput } from "../../atoms/my_clean_code_atoms";
import type { ApiKeyItem } from "./ApiKeyManagement";

// ── Types ──────────────────────────────────────────────────────────────────

type ApiKeyFormProps = {
  token?: string;
  formId: string;
  initialValues?: Partial<ApiKeyItem>;
  onSuccess: () => void;
  onCreated: () => void;
  onSubmittingChange?: (b: boolean) => void;
  onResetReady?: (fn: () => void) => void;
  onKeyRevealed?: (key: string) => void;
};

type CreateFormValues = { bootstrap_key: string; name: string; usage_limit: string; expires_at: string };
type EditFormValues   = { name: string; is_active: boolean; usage_limit: string; expires_at: string };

// ── Validation ─────────────────────────────────────────────────────────────

const createSchema = Yup.object({
  bootstrap_key: Yup.string().trim().required("Bootstrap API key is required"),
  name:          Yup.string().trim().required("Name is required"),
  usage_limit:   Yup.string(),
  expires_at:    Yup.string(),
});

const editSchema = Yup.object({
  name:        Yup.string().trim().required("Name is required"),
  is_active:   Yup.boolean(),
  usage_limit: Yup.string(),
  expires_at:  Yup.string(),
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? "Operation failed";
}

const IDENTITY_BASE = (import.meta.env.VITE_IDENTITY_API_URL as string | undefined) ?? "";

// ── Key Reveal Banner (shown inside modal body after creation) ─────────────

export const KeyRevealBanner: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const [copied,  setCopied]  = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToastnew.error("Failed to copy — please copy manually");
    }
  };

  return (
    <div style={{
      borderRadius: 10, border: "1px solid #fcd34d",
      background: "rgba(254,243,199,0.2)", padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>⚠</span>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "var(--badge-amber-text)" }}>
            Copy your API key now
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--fi-muted)" }}>
            This key will not be shown again after you close this panel.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            readOnly
            type={visible ? "text" : "password"}
            value={apiKey}
            style={{
              width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12,
              padding: "7px 36px 7px 10px", borderRadius: 7,
              border: "1px solid var(--fi-border)", background: "var(--fi-bg)",
              color: "var(--fi-text)", boxSizing: "border-box", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--fi-muted)", display: "flex", alignItems: "center",
            }}
            aria-label={visible ? "Hide key" : "Show key"}
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px",
            fontSize: 12, borderRadius: 7, border: "1px solid var(--fi-border)",
            background: "var(--fi-bg)", color: "var(--fi-text)", cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {copied ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

// ── Main Form ──────────────────────────────────────────────────────────────

const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  token, formId, initialValues, onSuccess, onCreated,
  onSubmittingChange, onResetReady, onKeyRevealed,
}) => {
  const isEdit = Boolean(initialValues?._id);

  // ── Edit form ──────────────────────────────────────────────────────────
  if (isEdit) {
    const editInitial: EditFormValues = {
      name:        initialValues?.name ?? "",
      is_active:   initialValues?.is_active ?? true,
      usage_limit: initialValues?.usage_limit != null ? String(initialValues.usage_limit) : "",
      expires_at:  initialValues?.expires_at
        ? new Date(initialValues.expires_at).toISOString().split("T")[0]
        : "",
    };

    const handleEdit = async (
      values: EditFormValues,
      { setSubmitting }: { setSubmitting: (v: boolean) => void },
    ) => {
      onSubmittingChange?.(true);
      try {
        const payload: Record<string, unknown> = {
          name:      values.name.trim(),
          is_active: values.is_active,
        };
        if (values.usage_limit) payload.usage_limit = Number(values.usage_limit);
        if (values.expires_at)  payload.expires_at  = values.expires_at;

        await patchData({ endpoint: `api-keys/${initialValues!._id}`, token, instance: "identity", data: payload });
        showToastnew.success("API key updated");
        onSuccess();
      } catch (err: unknown) {
        showToastnew.error(extractErrorMessage(err));
      } finally {
        setSubmitting(false);
        onSubmittingChange?.(false);
      }
    };

    return (
      <Formik initialValues={editInitial} validationSchema={editSchema} enableReinitialize onSubmit={handleEdit}>
        {({ values, errors, touched, handleChange, handleBlur, setFieldValue, resetForm }) => {
          onResetReady?.(resetForm);
          return (
            <Form id={formId} autoComplete="off" noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440 }}>
                <CleanInput
                  label="Name" required name="name" placeholder="Key name"
                  value={values.name} onChange={handleChange} onBlur={handleBlur}
                  error={touched.name ? errors.name : ""}
                />
                <CleanInput
                  label="Usage Limit" name="usage_limit" type="number" placeholder="e.g. 1000"
                  value={values.usage_limit} onChange={handleChange} onBlur={handleBlur}
                />
                <CleanInput
                  label="Expires At" name="expires_at" type="date"
                  value={values.expires_at} onChange={handleChange} onBlur={handleBlur}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={values.is_active}
                    onClick={() => setFieldValue("is_active", !values.is_active)}
                    style={{
                      position: "relative", display: "inline-flex", flexShrink: 0,
                      width: 36, height: 20, cursor: "pointer", borderRadius: 10,
                      border: "2px solid transparent", outline: "none",
                      background: values.is_active ? "var(--btn-primary-bg)" : "var(--fi-border)",
                      transition: "background 200ms",
                    }}
                  >
                    <span style={{
                      display: "inline-block", width: 16, height: 16, borderRadius: 8,
                      background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      transform: values.is_active ? "translateX(16px)" : "translateX(0)",
                      transition: "transform 200ms", pointerEvents: "none",
                    }} />
                  </button>
                  <span style={{ fontSize: 13, color: "var(--fi-text)" }}>
                    {values.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>
    );
  }

  // ── Create form ────────────────────────────────────────────────────────
  const createInitial: CreateFormValues = { bootstrap_key: "", name: "", usage_limit: "", expires_at: "" };

  const handleCreate = async (
    values: CreateFormValues,
    { setSubmitting, resetForm }: { setSubmitting: (v: boolean) => void; resetForm: () => void },
  ) => {
    onSubmittingChange?.(true);
    try {
      const payload: Record<string, unknown> = { name: values.name.trim() };
      if (values.usage_limit) payload.usage_limit = Number(values.usage_limit);
      if (values.expires_at)  payload.expires_at  = values.expires_at;

      const res = await axios.post<{ success: boolean; data: { key: string } }>(
        `${IDENTITY_BASE}/api-keys`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${token ?? ""}`,
            "x-api-key":    values.bootstrap_key.trim(),
          },
        },
      );

      const key = res.data?.data?.key;
      if (!key) throw new Error("No key in response");

      showToastnew.success("API key created — copy it now!");
      resetForm();
      onCreated();
      onKeyRevealed?.(key);
    } catch (err: unknown) {
      showToastnew.error(extractErrorMessage(err));
      onSubmittingChange?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik initialValues={createInitial} validationSchema={createSchema} onSubmit={handleCreate}>
      {({ values, errors, touched, handleChange, handleBlur, resetForm }) => {
        onResetReady?.(resetForm);
        return (
          <Form id={formId} autoComplete="off" noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440 }}>
              <CleanInput
                label="Bootstrap API Key" required name="bootstrap_key"
                placeholder="Paste FOR_API_KEY_CREATE_KEY from .env"
                value={values.bootstrap_key} onChange={handleChange} onBlur={handleBlur}
                error={touched.bootstrap_key ? errors.bootstrap_key : ""}
                hint="Used only for this creation request. Not stored anywhere."
              />
              <CleanInput
                label="Name" required name="name" placeholder="e.g. Production Key"
                value={values.name} onChange={handleChange} onBlur={handleBlur}
                error={touched.name ? errors.name : ""}
              />
              <CleanInput
                label="Usage Limit" name="usage_limit" type="number" placeholder="e.g. 1000"
                value={values.usage_limit} onChange={handleChange} onBlur={handleBlur}
              />
              <CleanInput
                label="Expires At" name="expires_at" type="date"
                value={values.expires_at} onChange={handleChange} onBlur={handleBlur}
              />
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default ApiKeyForm;
