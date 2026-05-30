import React, { useMemo } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { getData, postData, patchData } from "../../services/crmServices";
import {
  CleanInput, CleanSelect, type SelectOption,
} from "../../atoms/my_clean_code_atoms";
import ImageUploadAvatar from "../../atoms/ImageUploadAvatar";

// ── Types ──────────────────────────────────────────────────────────────────

interface RolesApiItem { _id: string; role_name: string }
interface RolesApiResponse { success: boolean; data: { data: RolesApiItem[]; total: number } }

type UserFormValues = {
  name: string;
  email: string;
  mobile_no: string;
  password: string;
  role_id: string;
  profile_image_url: string;
};

type UserFormProps = {
  token?: string;
  formId: string;
  initialValues?: {
    _id?: string;
    name: string;
    email: string;
    mobile_no?: string;
    role_id?: string;
    profile_image_url?: string | null;
  };
  onSuccess: () => void;
  onSubmittingChange?: (b: boolean) => void;
  onResetReady?: (fn: () => void) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { error?: { response?: { data?: { message?: string } } }; message?: string };
  return e?.error?.response?.data?.message ?? e?.message ?? "Operation failed";
}

async function fetchRoleOptions(token?: string): Promise<SelectOption[]> {
  const res = await getData<RolesApiResponse>({
    endpoint: "roles", token, instance: "identity", params: { page: 1, limit: 100 },
  });
  return res.data.data.map((r) => ({ label: r.role_name, value: r._id }));
}

// ── Component ──────────────────────────────────────────────────────────────

const UserForm: React.FC<UserFormProps> = ({
  token, formId, initialValues, onSuccess, onSubmittingChange, onResetReady,
}) => {
  const isEdit = !!initialValues?._id;
  const [roles,        setRoles]        = React.useState<SelectOption[]>([]);
  const [loadingRoles, setLoadingRoles] = React.useState(true);

  React.useEffect(() => {
    setLoadingRoles(true);
    fetchRoleOptions(token)
      .then(setRoles)
      .catch(() => showToastnew.error("Failed to load roles"))
      .finally(() => setLoadingRoles(false));
  }, [token]);

  const validationSchema = useMemo(
    () => Yup.object({
      name:      Yup.string().trim().required("Name is required"),
      email:     Yup.string().email("Invalid email").required("Email is required"),
      mobile_no: Yup.string(),
      password:  isEdit
        ? Yup.string()
        : Yup.string().required("Password is required").min(6, "Minimum 6 characters"),
      role_id:           Yup.string().required("Role is required"),
      profile_image_url: Yup.string(),
    }),
    [isEdit],
  );

  const initialFormValues: UserFormValues = {
    name:              initialValues?.name              ?? "",
    email:             initialValues?.email             ?? "",
    mobile_no:         initialValues?.mobile_no         ?? "",
    password:          "",
    role_id:           initialValues?.role_id           ?? "",
    profile_image_url: initialValues?.profile_image_url ?? "",
  };

  const handleSubmit = async (
    values: UserFormValues,
    { setSubmitting, resetForm }: { setSubmitting: (b: boolean) => void; resetForm: () => void },
  ) => {
    onSubmittingChange?.(true);
    try {
      const imageUrl = values.profile_image_url.trim() || undefined;

      if (isEdit) {
        await patchData({
          endpoint: `users/${initialValues!._id}`, token, instance: "identity",
          data: {
            username:          values.name.trim(),
            email:             values.email.toLowerCase().trim(),
            mobile_no:         values.mobile_no.trim(),
            role_id:           values.role_id,
            profile_image_url: imageUrl,
          },
        });
        showToastnew.success("User updated successfully");
      } else {
        await postData({
          endpoint: "users", token, instance: "identity",
          data: {
            username:          values.name.trim(),
            email:             values.email.toLowerCase().trim(),
            mobile_no:         values.mobile_no.trim(),
            password:          values.password,
            role_id:           values.role_id,
            profile_image_url: imageUrl,
          },
        });
        showToastnew.success("User created successfully");
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
      initialValues={initialFormValues}
      validationSchema={validationSchema}
      enableReinitialize
      onSubmit={handleSubmit}
    >
      {({ values, errors, touched, handleChange, handleBlur, setFieldValue, resetForm }) => {
        // Expose reset function to parent footer
        onResetReady?.(resetForm);
        return (
          <Form id={formId} noValidate>
            {/* Avatar upload — centred above the form */}
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 16 }}>
              <ImageUploadAvatar
                url={values.profile_image_url || null}
                name={values.name}
                size={80}
                onUpload={(url) => setFieldValue("profile_image_url", url)}
              />
            </div>

            <div className="form-grid">
              <CleanInput
                label="Name" required placeholder="Full name"
                name="name" value={values.name}
                onChange={handleChange} onBlur={handleBlur}
                error={touched.name ? errors.name : ""}
              />
              <CleanInput
                label="Email" required type="email" placeholder="user@example.com"
                name="email" value={values.email}
                onChange={handleChange} onBlur={handleBlur}
                error={touched.email ? errors.email : ""}
                readOnly={isEdit}
              />
              <CleanInput
                label="Mobile No" placeholder="+91XXXXXXXXXX"
                name="mobile_no" value={values.mobile_no}
                onChange={handleChange} onBlur={handleBlur}
                error={touched.mobile_no ? errors.mobile_no : ""}
              />
              {!isEdit && (
                <CleanInput
                  label="Password" required type="password" placeholder="Min 6 characters"
                  name="password" value={values.password}
                  onChange={handleChange} onBlur={handleBlur}
                  error={touched.password ? errors.password : ""}
                />
              )}
              <CleanSelect
                label="Role" required
                value={values.role_id}
                options={roles}
                placeholder={loadingRoles ? "Loading roles…" : "Select Role"}
                disabled={loadingRoles}
                onChange={(e) => setFieldValue("role_id", e.target.value)}
                onBlur={handleBlur}
                error={touched.role_id ? errors.role_id : ""}
              />
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

export default UserForm;
