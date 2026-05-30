/**
 * ImageUploadAvatar — circular avatar with click-to-upload.
 *
 * Cookies are managed at /help-chat only.
 * If cookies are not configured, shows a small hint to go there.
 */
import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadToImageKit } from "../utils/imagekitUpload";

interface ImageUploadAvatarProps {
  url?: string | null;
  name?: string;
  size?: number;
  onUpload: (url: string) => void;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ImageUploadAvatar: React.FC<ImageUploadAvatarProps> = ({
  url, name, size = 72, onUpload,
}) => {
  const inputRef             = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const iconSize   = Math.round(size * 0.3);
  const fontSize   = Math.round(size * 0.36);
  const showImg    = !!url && !imgFailed;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const cdnUrl = await uploadToImageKit(file);
      onUpload(cdnUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(
        msg === "NO_COOKIES"
          ? "Image storage not configured — go to Help Chat to set it up."
          : msg,
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>

        {/* Circle */}
        <div
          onClick={uploading ? undefined : () => { setError(null); inputRef.current?.click(); }}
          title={uploading ? "Uploading…" : "Click to upload profile image"}
          style={{
            position:       "relative",
            width:          size,
            height:         size,
            borderRadius:   "50%",
            cursor:         uploading ? "default" : "pointer",
            flexShrink:     0,
            overflow:       "hidden",
            border:         "2px solid var(--fi-border)",
            background:     showImg ? "transparent" : "var(--sc-surface)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            userSelect:     "none",
          }}
        >
          {showImg ? (
            <img
              src={url!}
              alt={name ?? "avatar"}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span style={{ fontSize, fontWeight: 700, color: "var(--fi-muted)", lineHeight: 1 }}>
              {getInitials(name)}
            </span>
          )}

          {/* Hover / loading overlay */}
          <div
            className="iau-overlay"
            style={{
              position:       "absolute",
              inset:          0,
              borderRadius:   "50%",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     uploading ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
              transition:     "background 0.15s ease",
            }}
          >
            {uploading
              ? <Loader2 size={iconSize} style={{ color: "#fff", animation: "iau-spin 0.8s linear infinite" }} />
              : <Camera  size={iconSize} style={{ color: "#fff", opacity: 0 }} className="iau-camera" />
            }
          </div>
        </div>

        {/* Error */}
        {error && (
          <span style={{
            fontSize: 10, color: "var(--fi-border-error)",
            maxWidth: size * 2.2, textAlign: "center", lineHeight: 1.4,
          }}>
            {error}
          </span>
        )}
      </div>

      <style>{`
        .iau-overlay:hover { background: rgba(0,0,0,0.38) !important; }
        .iau-overlay:hover .iau-camera { opacity: 1 !important; }
        @keyframes iau-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default ImageUploadAvatar;
