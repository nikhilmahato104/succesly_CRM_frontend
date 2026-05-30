import React, { useState } from "react";
import { CheckCircle2, Clipboard, Code2, Trash2 } from "lucide-react";
import builtInCookies from "../../config/imagekit-cookies.json";
import {
  saveImageKitCookies,
  getImageKitCookies,
  clearImageKitCookies,
  hasImageKitCookies,
  uploadToImageKit,
} from "../../utils/imagekitUpload";

// ── ImageKit cookie setup card ────────────────────────────────────────────────

const CookieSetupCard: React.FC = () => {
  const [saved,       setSaved]       = useState(() => hasImageKitCookies());
  const [pasteText,   setPasteText]   = useState("");
  const [showPaste,   setShowPaste]   = useState(false);
  const [msg,         setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const loadFromCode = () => {
    saveImageKitCookies(JSON.stringify(builtInCookies));
    setSaved(true);
    setShowPaste(false);
    flash("ok", "Loaded cookies from built-in config and saved to localStorage.");
  };

  const loadFromPaste = () => {
    const text = pasteText.trim();
    if (!text) { flash("err", "Paste field is empty."); return; }
    saveImageKitCookies(text);
    setSaved(true);
    setShowPaste(false);
    setPasteText("");
    flash("ok", "Pasted cookies saved to localStorage.");
  };

  const clearAll = () => {
    clearImageKitCookies();
    setSaved(false);
    setPasteText("");
    setShowPaste(false);
    flash("ok", "Cookies cleared.");
  };

  return (
    <div style={{
      border:       "1px solid var(--sc-border, #e5e5e5)",
      borderRadius: 12,
      padding:      24,
      maxWidth:     560,
      display:      "flex",
      flexDirection:"column",
      gap:          16,
      background:   "var(--sc-card, #fff)",
      boxShadow:    "0 1px 4px rgba(0,0,0,0.07)",
    }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "var(--fi-text, #0d0d0d)" }}>
          ImageKit — Session Setup
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--fi-muted, #9e9e9e)", lineHeight: 1.6 }}>
          Cookies are saved once in <code>localStorage</code> and reused across the entire platform
          for profile image uploads, chat attachments, and any other media.
        </p>
      </div>

      {/* Current status */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          8,
        padding:      "8px 12px",
        borderRadius: 8,
        background:   saved ? "var(--badge-green-bg, #dcfce7)" : "var(--badge-amber-bg, #fef3c7)",
        color:        saved ? "var(--badge-green-text, #166534)" : "var(--badge-amber-text, #92400e)",
        fontSize:     12,
        fontWeight:   600,
      }}>
        {saved ? <CheckCircle2 size={14} /> : <span>⚠</span>}
        {saved ? "Cookies are saved — image upload ready" : "No cookies saved — image upload will not work"}
        {saved && (
          <button
            onClick={clearAll}
            title="Clear saved cookies"
            style={{
              marginLeft: "auto", background: "none", border: "none",
              cursor: "pointer", padding: 2, color: "inherit", display: "flex",
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: msg.type === "ok" ? "var(--badge-green-bg, #dcfce7)" : "var(--badge-red-bg, #fee2e2)",
          color:      msg.type === "ok" ? "var(--badge-green-text, #166534)" : "var(--badge-red-text, #991b1b)",
        }}>
          {msg.text}
        </div>
      )}

      {/* Option 1 — load from built-in JSON */}
      <div style={{
        border:       "1px solid var(--sc-border, #e5e5e5)",
        borderRadius: 8,
        padding:      14,
        display:      "flex",
        flexDirection:"column",
        gap:          8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Code2 size={15} style={{ color: "var(--btn-primary-bg, #111)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fi-text, #0d0d0d)" }}>
            Option 1 — Use cookies from code
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--fi-muted, #9e9e9e)", lineHeight: 1.5 }}>
          Loads the cookies already saved in <code>src/config/imagekit-cookies.json</code> and writes
          them to localStorage in one click. Update the JSON file when the session expires.
        </p>
        <button
          onClick={loadFromCode}
          style={{
            alignSelf:    "flex-start",
            padding:      "7px 16px",
            background:   "var(--btn-primary-bg, #111)",
            color:        "var(--btn-primary-text, #fff)",
            border:       "none",
            borderRadius: 7,
            cursor:       "pointer",
            fontSize:     12,
            fontWeight:   600,
          }}
        >
          Load from imagekit-cookies.json
        </button>
      </div>

      {/* Option 2 — paste directly */}
      <div style={{
        border:       "1px solid var(--sc-border, #e5e5e5)",
        borderRadius: 8,
        padding:      14,
        display:      "flex",
        flexDirection:"column",
        gap:          8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clipboard size={15} style={{ color: "var(--btn-primary-bg, #111)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fi-text, #0d0d0d)" }}>
            Option 2 — Paste fresh cookies
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--fi-muted, #9e9e9e)", lineHeight: 1.5 }}>
          DevTools → Application → Cookies → imagekit.io → select all rows → copy → paste below.
          Accepts the raw copy-paste text or a JSON array.
        </p>

        {!showPaste ? (
          <button
            onClick={() => setShowPaste(true)}
            style={{
              alignSelf:    "flex-start",
              padding:      "7px 16px",
              background:   "none",
              color:        "var(--fi-text, #0d0d0d)",
              border:       "1px solid var(--sc-border, #e5e5e5)",
              borderRadius: 7,
              cursor:       "pointer",
              fontSize:     12,
              fontWeight:   600,
            }}
          >
            Paste cookies manually
          </button>
        ) : (
          <>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste cookie string or JSON array here…"
              rows={5}
              autoFocus
              style={{
                width:        "100%",
                fontSize:     11,
                fontFamily:   "monospace",
                padding:      8,
                borderRadius: 6,
                border:       "1px solid var(--sc-border, #e5e5e5)",
                background:   "var(--fi-bg, #fff)",
                color:        "var(--fi-text, #0d0d0d)",
                resize:       "vertical",
                boxSizing:    "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={loadFromPaste}
                disabled={!pasteText.trim()}
                style={{
                  padding:      "7px 16px",
                  background:   pasteText.trim() ? "var(--btn-primary-bg, #111)" : "var(--sc-border, #e5e5e5)",
                  color:        pasteText.trim() ? "var(--btn-primary-text, #fff)" : "var(--fi-muted, #9e9e9e)",
                  border:       "none",
                  borderRadius: 7,
                  cursor:       pasteText.trim() ? "pointer" : "not-allowed",
                  fontSize:     12,
                  fontWeight:   600,
                }}
              >
                Save cookies
              </button>
              <button
                onClick={() => { setShowPaste(false); setPasteText(""); }}
                style={{
                  padding:      "7px 14px",
                  background:   "none",
                  color:        "var(--fi-muted, #9e9e9e)",
                  border:       "1px solid var(--sc-border, #e5e5e5)",
                  borderRadius: 7,
                  cursor:       "pointer",
                  fontSize:     12,
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Quick upload test ─────────────────────────────────────────────────────────

const UploadTestCard: React.FC = () => {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [url,      setUrl]      = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setUrl(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const cdnUrl = await uploadToImageKit(file);
      setUrl(cdnUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg === "NO_COOKIES" ? "No cookies configured. Use the setup card above first." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border:       "1px solid var(--sc-border, #e5e5e5)",
      borderRadius: 12,
      padding:      24,
      maxWidth:     560,
      display:      "flex",
      flexDirection:"column",
      gap:          14,
      background:   "var(--sc-card, #fff)",
      boxShadow:    "0 1px 4px rgba(0,0,0,0.07)",
    }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--fi-text, #0d0d0d)" }}>
        Test Upload
      </h2>

      <input type="file" accept="image/*" onChange={handleFile} style={{ fontSize: 13 }} />

      {preview && (
        <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "contain", border: "1px solid var(--sc-border, #e5e5e5)" }} />
      )}

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        style={{
          alignSelf:    "flex-start",
          padding:      "8px 18px",
          background:   loading || !file ? "var(--sc-border, #e5e5e5)" : "var(--btn-primary-bg, #111)",
          color:        loading || !file ? "var(--fi-muted, #9e9e9e)" : "var(--btn-primary-text, #fff)",
          border:       "none",
          borderRadius: 7,
          cursor:       loading || !file ? "not-allowed" : "pointer",
          fontSize:     13,
          fontWeight:   600,
        }}
      >
        {loading ? "Uploading…" : "Upload to ImageKit"}
      </button>

      {error && <p style={{ margin: 0, color: "var(--badge-red-text, #991b1b)", fontSize: 12 }}>{error}</p>}
      {url && (
        <div>
          <p style={{ margin: "0 0 4px", color: "var(--badge-green-text, #166534)", fontWeight: 600, fontSize: 12 }}>
            ✓ Uploaded successfully
          </p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--btn-primary-bg, #111)", fontSize: 12, wordBreak: "break-all" }}>
            {url}
          </a>
        </div>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const HelpChatPage: React.FC = () => (
  <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
    <div>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "var(--fi-text, #0d0d0d)" }}>
        Help Chat
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--fi-muted, #9e9e9e)" }}>
        Configure image upload (ImageKit) and test it here. Cookies saved here are used platform-wide.
      </p>
    </div>

    <CookieSetupCard />
    <UploadTestCard />

    <div style={{
      flex: 1, minHeight: 120,
      border: "1px solid var(--sc-border, #e5e5e5)",
      borderRadius: 12,
      padding: 20,
      color: "var(--fi-muted, #9e9e9e)",
      fontSize: 13,
      background: "var(--sc-card, #fff)",
    }}>
      Chat messages will appear here…
    </div>
  </div>
);

export default HelpChatPage;
