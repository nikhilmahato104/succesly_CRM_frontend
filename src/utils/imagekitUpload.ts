/**
 * imagekitUpload.ts
 *
 * Reusable ImageKit upload utility used across the entire platform.
 *
 * SETUP (one-time per browser session):
 *   1. Open imagekit.io in the browser, sign in.
 *   2. DevTools → Application → Cookies → imagekit.io → select all rows → copy.
 *   3. Call saveImageKitCookies(pasted string) — it accepts the raw copy/paste
 *      text OR a JSON array from the DevTools export.
 *   4. Cookies are saved in localStorage and reused automatically from then on.
 */

const IK_PUBLIC_KEY = "public_7rJWGD1cCcPUnbwQQ6wGFQREKbU=";
const IK_CSRF_TOKEN = "K3DnTkCR-gsd9meJreeHWSHwQOqhXs5tApQc";
const LS_KEY        = "ik_session_cookies";

// ── Cookie storage ────────────────────────────────────────────────────────────

export function saveImageKitCookies(raw: string): void {
  localStorage.setItem(LS_KEY, raw.trim());
}

export function getImageKitCookies(): string {
  return localStorage.getItem(LS_KEY) ?? "";
}

export function clearImageKitCookies(): void {
  localStorage.removeItem(LS_KEY);
}

export function hasImageKitCookies(): boolean {
  return !!getImageKitCookies();
}

// Accepts JSON array (DevTools copy) OR plain "name=val; name2=val2" string
function toCookieString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    const arr = JSON.parse(trimmed) as { name: string; value: string }[];
    return arr.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    return trimmed;
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Upload a file to ImageKit and return its public URL.
 * Throws if cookies are not configured or if the upload fails.
 */
export async function uploadToImageKit(file: File): Promise<string> {
  const raw = getImageKitCookies();
  if (!raw) throw new Error("NO_COOKIES");

  const cookieHeader = toCookieString(raw);

  // Step 1 — get signed upload token via Vite proxy (/ik-signature)
  const sigRes = await fetch("/ik-signature", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "csrf-token":   IK_CSRF_TOKEN,
      "x-ik-cookie":  cookieHeader,
    },
    body: JSON.stringify({
      publicKey: IK_PUBLIC_KEY,
      expire: 3600,
      uploadPayload: {
        folder:                  "/",
        fileName:                file.name,
        responseFields:          "tags,customCoordinates,isPrivateFile,embeddedMetadata,isPublished,customMetadata,selectedFieldsSchema,metadata,mime",
        overwriteCustomMetadata: "true",
        isPrivateFile:           "false",
        isPublished:             "true",
        useUniqueFileName:       "false",
        overwriteFile:           "true",
        overwriteTags:           "true",
        overwriteDescription:    "true",
        overwriteAITags:         "true",
      },
    }),
  });

  if (!sigRes.ok) {
    const text = await sigRes.text();
    if (sigRes.status === 401 || sigRes.status === 403) throw new Error("NO_COOKIES");
    throw new Error(`Signature failed (${sigRes.status}): ${text}`);
  }
  const { token } = await sigRes.json() as { token: string };

  // Step 2 — upload file to ImageKit
  const form = new FormData();
  form.append("folder",                  "/");
  form.append("fileName",                file.name);
  form.append("responseFields",          "tags,customCoordinates,isPrivateFile,embeddedMetadata,isPublished,customMetadata,selectedFieldsSchema,metadata,mime");
  form.append("overwriteCustomMetadata", "true");
  form.append("isPrivateFile",           "false");
  form.append("isPublished",             "true");
  form.append("useUniqueFileName",       "false");
  form.append("overwriteFile",           "true");
  form.append("overwriteTags",           "true");
  form.append("overwriteDescription",    "true");
  form.append("overwriteAITags",         "true");
  form.append("file",                    file, file.name);
  form.append("token",                   token);

  const uploadRes = await fetch("https://upload.imagekit.io/api/v2-alpha/files/upload", {
    method: "POST",
    body: form,
  });

  if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  const data = await uploadRes.json() as { url: string };
  return data.url;
}
