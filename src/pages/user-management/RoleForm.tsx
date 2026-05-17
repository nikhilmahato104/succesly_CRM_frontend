import React from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { postData, patchData, getData } from "../../services/crmServices";
import { Check } from "lucide-react";
import { useSelector } from "react-redux";
import { selectAccessToken } from "../../store/slices/authSlice";
import { CleanInput, CleanButton } from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────

type ModuleAccess = {
  module_id: string; label: string;
  create?: boolean; edit?: boolean; view?: boolean;
  delete?: boolean; transfer?: boolean; export?: boolean;
};

type ModuleFromAPI = {
  _id: string; module_id: string; module_name: string;
  is_active?: boolean;
};

type RoleFormProps = {
  token?: string;
  initialValues?: { _id?: string; role_name?: string; role_access?: any[] };
  onSuccess: () => void;
};

const PERM_FIELDS = ["create", "edit", "view", "delete", "transfer", "export"] as const;

// ── PermCheckbox ───────────────────────────────────────────────────────────

const PermCheckbox: React.FC<{ checked: boolean; onToggle: () => void; ariaLabel?: string }> = (
  { checked, onToggle, ariaLabel },
) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={onToggle}
    onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}
    style={{
      width: 18, height: 18, borderRadius: 4,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: `1.5px solid ${checked ? "var(--btn-primary-bg)" : "var(--fi-border)"}`,
      background: checked ? "var(--btn-primary-bg)" : "transparent",
      cursor: "pointer", flexShrink: 0, transition: "background 120ms, border-color 120ms",
      outline: "none",
    }}
  >
    {checked && <Check size={11} style={{ color: "var(--btn-primary-text)" }} />}
  </button>
);

// ── Component ──────────────────────────────────────────────────────────────

const RoleForm: React.FC<RoleFormProps> = ({ token, initialValues, onSuccess }) => {
  const authToken = useSelector(selectAccessToken);
  const [modules,       setModules]       = React.useState<ModuleFromAPI[]>([]);
  const [loadingModules, setLoadingModules] = React.useState(true);

  React.useEffect(() => {
    setLoadingModules(true);
    getData<{ success: boolean; data: { data: ModuleFromAPI[]; total: number } }>({
      endpoint: "modules", token: authToken || token, instance: "identity",
      params: { page: 1, limit: 100 },
    })
      .then((res) => setModules(res?.data?.data ?? []))
      .catch(() => { showToastnew.error("Failed to load modules"); setModules([]); })
      .finally(() => setLoadingModules(false));
  }, [authToken, token]);

  const validationSchema = Yup.object({
    role_name: Yup.string().trim().required("Role name is required"),
    role_access: Yup.array().test(
      "at-least-one",
      "At least one permission must be selected",
      (arr: any[] | undefined) => !!arr?.some((m) => PERM_FIELDS.some((f) => m[f])),
    ),
  });

  const prepareInitial = () => {
    if (modules.length === 0) return { role_name: initialValues?.role_name ?? "", role_access: [] };
    const roleAccess = modules.map((m) => ({
      module_id: m.module_id,
      label:     m.module_name,
      ...(initialValues?.role_access?.find((r: { module_id: string }) => r.module_id === m.module_id) || {}),
    }));
    return { role_name: initialValues?.role_name ?? "", role_access: roleAccess };
  };

  const buildPayload = (values: any) => ({
    role_name:   values.role_name.trim(),
    role_access: values.role_access.map((r: any) => ({
      module_id: r.module_id,
      ...Object.fromEntries(PERM_FIELDS.map((f) => [f, !!r[f]])),
    })),
  });

  const handleSubmit = async (values: any, { setSubmitting, resetForm }: any) => {
    try {
      if (initialValues?._id) {
        await patchData({ endpoint: `roles/${initialValues._id}`, token: authToken || token, instance: "identity", data: buildPayload(values) });
        showToastnew.success("Role updated successfully");
        onSuccess();
      } else {
        await postData({ endpoint: "roles", token: authToken || token, instance: "identity", data: buildPayload(values) });
        showToastnew.success("Role created successfully");
        resetForm();
        onSuccess();
      }
    } catch (err: any) {
      showToastnew.error(err?.error?.response?.data?.error || err?.data?.message || "Failed to save role");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingModules) {
    return <p style={{ fontSize: 13, color: "var(--fi-muted)", padding: "16px 0" }}>Loading modules…</p>;
  }

  if (modules.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--fi-muted)", padding: "16px 0" }}>No modules available. Contact administrator.</p>;
  }

  return (
    <Formik
      initialValues={prepareInitial()}
      validationSchema={validationSchema}
      enableReinitialize
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting, setFieldValue, resetForm }) => {
        const togglePerm = (moduleId: string, field: keyof ModuleAccess) => {
          setFieldValue(
            "role_access",
            (values.role_access || []).map((m: ModuleAccess) =>
              m.module_id === moduleId ? { ...m, [field]: !m[field] } : m,
            ),
          );
        };

        return (
          <Form autoComplete="off">
            <div style={{ maxWidth: 340, marginBottom: 16 }}>
              <CleanInput
                label="Role Name" required placeholder="Enter role name"
                name="role_name" value={values.role_name}
                onChange={handleChange} onBlur={handleBlur}
                error={touched.role_name ? (errors.role_name as string) : ""}
              />
            </div>

            {/* Permissions table */}
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--fi-border)", marginBottom: 16 }}>
              <table style={{ width: "100%", minWidth: 580, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--dt-header)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--dt-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                      Module
                    </th>
                    {PERM_FIELDS.map((f) => (
                      <th key={f} style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--dt-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(values.role_access || []).map((m: ModuleAccess, i: number) => (
                    <tr
                      key={m.module_id}
                      style={{
                        borderTop: i > 0 ? "1px solid var(--fi-border)" : undefined,
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dt-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, color: "var(--fi-text)" }}>
                        {m.label}
                      </td>
                      {PERM_FIELDS.map((f) => (
                        <td key={f} style={{ padding: "8px 12px", textAlign: "center" }}>
                          <PermCheckbox
                            checked={!!m[f]}
                            onToggle={() => togglePerm(m.module_id, f)}
                            ariaLabel={`${m.label} ${f}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errors.role_access && (
              <p style={{ fontSize: 11, color: "var(--fi-border-error)", marginBottom: 12 }}>
                {String(errors.role_access)}
              </p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <CleanButton type="submit" variant="primary" size="sm" loading={isSubmitting}>
                {initialValues?._id ? "Update Role" : "Create Role"}
              </CleanButton>
              <CleanButton type="button" variant="outline" size="sm" onClick={() => resetForm()} disabled={isSubmitting}>
                Reset
              </CleanButton>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default RoleForm;
