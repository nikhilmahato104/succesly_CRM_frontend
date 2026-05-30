import React from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { postData, patchData } from "../../services/crmServices";
import { CleanInput } from "../../atoms/my_clean_code_atoms";

// ── Types ──────────────────────────────────────────────────────────────────

type ModuleFormProps = {
  token?: string;
  formId: string;
  initialValues?: { _id?: string; module_id?: string; module_name?: string; is_active?: boolean };
  onSuccess: () => void;
  onSubmittingChange?: (b: boolean) => void;
  onResetReady?: (fn: () => void) => void;
};

type FormValues = { module_id: string; module_name: string; is_active: boolean };

// ── Validation ─────────────────────────────────────────────────────────────

const createSchema = Yup.object({
  module_id:   Yup.string().trim().required("Module ID is required")
    .matches(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  module_name: Yup.string().trim().required("Module name is required"),
});

const editSchema = Yup.object({
  module_name: Yup.string().trim().required("Module name is required"),
  is_active:   Yup.boolean(),
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Operation failed";
}

// ── Component ──────────────────────────────────────────────────────────────

const ModuleForm: React.FC<ModuleFormProps> = ({
  token, formId, initialValues, onSuccess, onSubmittingChange, onResetReady,
}) => {
  const isEdit = Boolean(initialValues?._id);

  const initial: FormValues = {
    module_id:   initialValues?.module_id   ?? "",
    module_name: initialValues?.module_name ?? "",
    is_active:   initialValues?.is_active   ?? true,
  };

  const handleSubmit = async (
    values: FormValues,
    { setSubmitting, resetForm }: { setSubmitting: (v: boolean) => void; resetForm: () => void },
  ) => {
    onSubmittingChange?.(true);
    try {
      if (isEdit) {
        await patchData({
          endpoint: `modules/${initialValues!._id}`, token, instance: "identity",
          data: { module_name: values.module_name.trim(), is_active: values.is_active },
        });
        showToastnew.success("Module updated successfully");
      } else {
        await postData({
          endpoint: "modules", token, instance: "identity",
          data: { module_id: values.module_id.trim(), module_name: values.module_name.trim() },
        });
        showToastnew.success("Module created successfully");
        resetForm();
      }
      onSuccess();
    } catch (err: unknown) {
      showToastnew.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
      onSubmittingChange?.(false);
    }
  };

  return (
    <Formik
      initialValues={initial}
      validationSchema={isEdit ? editSchema : createSchema}
      enableReinitialize
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, handleChange, handleBlur, setFieldValue, resetForm }) => {
        onResetReady?.(resetForm);
        return (
          <Form id={formId} autoComplete="off" noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>

              <CleanInput
                label="Module ID (slug)"
                name="module_id"
                placeholder="e.g. user_management"
                value={values.module_id}
                onChange={handleChange}
                onBlur={handleBlur}
                readOnly={isEdit}
                error={touched.module_id ? (errors.module_id as string) : ""}
                hint={!isEdit ? "Lowercase letters, numbers, underscores only. Cannot be changed after creation." : undefined}
              />

              <CleanInput
                label="Module Name"
                name="module_name"
                placeholder="e.g. User Management"
                value={values.module_name}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.module_name ? (errors.module_name as string) : ""}
              />

              {isEdit && (
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
              )}
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default ModuleForm;
