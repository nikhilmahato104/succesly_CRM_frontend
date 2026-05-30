import React, { useState } from "react";

// ── ImageKit (TEST ONLY) ─────────────────────────────────────────────────────
const IK_PUBLIC_KEY = "public_7rJWGD1cCcPUnbwQQ6wGFQREKbU=";
const IK_CSRF_TOKEN = "K3DnTkCR-gsd9meJreeHWSHwQOqhXs5tApQc";

const card: React.CSSProperties = {
  border: "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "480px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

const btn = (disabled: boolean): React.CSSProperties => ({
  padding: "10px 20px",
  backgroundColor: disabled ? "#b0bec5" : "#e44d26",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "14px",
  fontWeight: 600,
  alignSelf: "flex-start",
});

const HelpChatPage: React.FC = () => {
  const [ikFile,    setIkFile]    = useState<File | null>(null);
  const [ikPreview, setIkPreview] = useState<string | null>(null);
  const [ikLoading, setIkLoading] = useState(false);
  const [ikUrl,     setIkUrl]     = useState<string | null>(null);
  const [ikError,   setIkError]   = useState<string | null>(null);
  const [ikCookie,  setIkCookie]  = useState("");

  // Accepts JSON array (DevTools export) OR plain "name=val; name2=val2" string
  const toCookieString = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("[")) return trimmed;
    try {
      const arr: { name: string; value: string }[] = JSON.parse(trimmed);
      return arr.map(c => `${c.name}=${c.value}`).join("; ");
    } catch {
      return trimmed;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setIkFile(file);
    setIkPreview(file ? URL.createObjectURL(file) : null);
    setIkUrl(null);
    setIkError(null);
  };

  const handleUpload = async () => {
    if (!ikFile) { setIkError("Please select a file first."); return; }

    setIkLoading(true);
    setIkError(null);
    setIkUrl(null);

    const cookieHeader = toCookieString(ikCookie);

    try {
      // Step 1 — get signed upload token via Vite proxy
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
            folder: "/",
            fileName: ikFile.name,
            responseFields: "tags,customCoordinates,isPrivateFile,embeddedMetadata,isPublished,customMetadata,selectedFieldsSchema,metadata,mime",
            overwriteCustomMetadata: "true",
            isPrivateFile: "false",
            isPublished: "true",
            useUniqueFileName: "false",
            overwriteFile: "true",
            overwriteTags: "true",
            overwriteDescription: "true",
            overwriteAITags: "true",
          },
        }),
      });

      if (!sigRes.ok) throw new Error(`Signature failed (${sigRes.status}): ${await sigRes.text()}`);
      const { token } = await sigRes.json();

      // Step 2 — upload file with the signed token
      const form = new FormData();
      form.append("folder",                 "/");
      form.append("fileName",               ikFile.name);
      form.append("responseFields",         "tags,customCoordinates,isPrivateFile,embeddedMetadata,isPublished,customMetadata,selectedFieldsSchema,metadata,mime");
      form.append("overwriteCustomMetadata","true");
      form.append("isPrivateFile",          "false");
      form.append("isPublished",            "true");
      form.append("useUniqueFileName",      "false");
      form.append("overwriteFile",          "true");
      form.append("overwriteTags",          "true");
      form.append("overwriteDescription",   "true");
      form.append("overwriteAITags",        "true");
      form.append("file",                   ikFile, ikFile.name);
      form.append("token",                  token);

      const uploadRes = await fetch("https://upload.imagekit.io/api/v2-alpha/files/upload", {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
      const data = await uploadRes.json();
      setIkUrl(data.url);
    } catch (err: any) {
      setIkError(err.message || "Upload failed.");
    } finally {
      setIkLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column", gap: "24px" }}>
      <h1 style={{ margin: 0 }}>Help Chat (In Progress)</h1>

      <div style={card}>
        <h2 style={{ margin: 0, fontSize: "18px" }}>Upload File → ImageKit</h2>

        <div>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#555", display: "block", marginBottom: "4px" }}>
            ImageKit Session Cookie
            <span style={{ fontWeight: 400, color: "#999", marginLeft: "6px" }}>
              (DevTools → Application → Cookies → imagekit.io → copy all)
            </span>
          </label>
          <textarea
            value={ikCookie}
            onChange={e => setIkCookie(e.target.value)}
            placeholder="Paste cookie string or JSON array here…"
            rows={3}
            style={{
              width: "100%",
              fontSize: "11px",
              fontFamily: "monospace",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        <input type="file" onChange={handleFileChange} style={{ fontSize: "14px" }} />

        {ikPreview && (
          <img src={ikPreview} alt="Preview" style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
        )}

        <button onClick={handleUpload} disabled={ikLoading || !ikFile} style={btn(ikLoading || !ikFile)}>
          {ikLoading ? "Uploading…" : "Upload to ImageKit"}
        </button>

        {ikError && <p style={{ margin: 0, color: "#d32f2f", fontSize: "13px" }}>{ikError}</p>}
        {ikUrl && (
          <div>
            <p style={{ margin: "0 0 4px", color: "#388e3c", fontWeight: 600, fontSize: "13px" }}>✓ Uploaded!</p>
            <a href={ikUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#e44d26", fontSize: "13px", wordBreak: "break-all" }}>
              {ikUrl}
            </a>
          </div>
        )}
      </div>

      <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: "12px", padding: "20px", color: "#9e9e9e" }}>
        Chat messages will appear here…
      </div>
    </div>
  );
};

export default HelpChatPage;
