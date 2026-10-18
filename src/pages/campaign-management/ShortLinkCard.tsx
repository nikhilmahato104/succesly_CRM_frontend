import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { CleanButton } from "../../atoms/my_clean_code_atoms";
import { showToastnew } from "../../services/toastifynewService/toastifynewService";
import { copyToClipboard } from "./types";
import { InfoTip } from "./InfoTip";
import { useIsMobile } from "./useIsMobile";
import type { MeaningKey } from "./meanings";

// ── CopyButton ─────────────────────────────────────────────────────────────────

export const CopyButton: React.FC<{ text: string; label?: string; size?: "xs" | "sm" }> = ({ text, label, size = "xs" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyToClipboard(text)) {
      setCopied(true);
      showToastnew.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } else {
      showToastnew.error("Could not copy — please copy manually");
    }
  };

  const icon = copied
    ? <Check style={{ width: 13, height: 13, color: "#22c55e" }} />
    : <Copy  style={{ width: 13, height: 13 }} />;

  return label
    ? <CleanButton variant="outline" size={size} iconLeft={icon} onClick={handleCopy}>{copied ? "Copied" : label}</CleanButton>
    : <CleanButton variant="ghost" size={size} icon={icon} onClick={handleCopy} title="Copy link" className="no-min-tap"
        style={{ width: 28, height: 28, flexShrink: 0 }} />;
};

// ── Shared bits ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  fontSize: 11, fontWeight: 600, color: "var(--fi-muted)", textTransform: "uppercase", letterSpacing: "0.06em",
};

const FieldLabel: React.FC<{ k: MeaningKey; children: React.ReactNode }> = ({ k, children }) => (
  <span style={labelStyle}>{children}<InfoTip k={k} /></span>
);

// ── LinkRow ────────────────────────────────────────────────────────────────────

const LinkRow: React.FC<{ label: string; tip: MeaningKey; url: string; primary?: boolean; copy?: boolean }> = ({
  label, tip, url, primary, copy = true,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <FieldLabel k={tip}>{label}</FieldLabel>
    <div style={{
      display: "flex", alignItems: "center", gap: 2, minWidth: 0,
      padding: "3px 4px 3px 10px", borderRadius: "var(--radius)", minHeight: 36,
      border: "1px solid var(--fi-border)", background: "var(--sc-surface)",
    }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        style={{
          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: "ui-monospace, monospace", fontSize: primary ? 13 : 12, fontWeight: primary ? 600 : 400,
          color: primary ? "#6366f1" : "var(--dt-text)", textDecoration: "none",
        }}
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      {copy && <CopyButton text={url} />}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: "var(--fi-muted)", flexShrink: 0 }}
      >
        <ExternalLink style={{ width: 13, height: 13 }} />
      </a>
    </div>
  </div>
);

// ── ShortLinkCard ──────────────────────────────────────────────────────────────

interface ShortLinkCardProps {
  shortUrl:        string;
  shortUrlPath:    string;
  slug:            string;
  destinationUrl?: string;
  finalUrl?:       string;
}

export const ShortLinkCard: React.FC<ShortLinkCardProps> = ({ shortUrl, shortUrlPath, slug, destinationUrl, finalUrl }) => {
  const isMobile = useIsMobile();
  const [qrTarget, setQrTarget] = useState<"subdomain" | "path">("subdomain");
  const qrRef = useRef<HTMLCanvasElement>(null);
  const qrUrl = qrTarget === "subdomain" ? shortUrl : shortUrlPath;

  const downloadQr = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${slug}.png`;
    a.click();
  };

  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 28, padding: "0 12px", border: "none", borderRadius: "var(--radius)",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    background: active ? "#6366f1" : "transparent",
    color:      active ? "#fff"    : "var(--fi-muted)",
  });

  const qrBlock = (
    <div style={{
      display: "flex", gap: 12, flexShrink: 0,
      flexDirection: isMobile ? "row" : "column",
      alignItems: "center",
      ...(isMobile && { padding: 10, borderRadius: "var(--radius)", border: "1px solid var(--fi-border)", background: "var(--sc-surface)" }),
    }}>
      <div style={{ padding: 6, background: "#fff", borderRadius: "var(--radius)", border: "1px solid var(--fi-border)", lineHeight: 0 }}>
        <QRCodeCanvas ref={qrRef} value={qrUrl} size={isMobile ? 104 : 132} marginSize={1} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: isMobile ? 1 : undefined, alignItems: "stretch", minWidth: 0 }}>
        <FieldLabel k="qr_code">QR code</FieldLabel>
        <div style={{ display: "flex", padding: 2, borderRadius: "var(--radius)", border: "1px solid var(--fi-border)", background: "var(--sc-card)" }}>
          <button type="button" className="no-min-tap" style={segBtn(qrTarget === "subdomain")} onClick={() => setQrTarget("subdomain")}>Short</button>
          <button type="button" className="no-min-tap" style={segBtn(qrTarget === "path")}      onClick={() => setQrTarget("path")}>Path</button>
        </div>
        <CleanButton variant="outline" size="sm" className="no-min-tap" iconLeft={<Download style={{ width: 12, height: 12 }} />}
          onClick={downloadQr} style={{ width: "100%", justifyContent: "center" }}>
          Download PNG
        </CleanButton>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 16, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <LinkRow label="Short link"  tip="short_link"  url={shortUrl} primary />
        <LinkRow label="Path link"   tip="path_link"   url={shortUrlPath} />
        {destinationUrl && <LinkRow label="Destination" tip="destination" url={destinationUrl} copy={false} />}
        {finalUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <FieldLabel k="redirects_to">Redirects to</FieldLabel>
            <span style={{ fontSize: 11, color: "var(--dt-muted)", wordBreak: "break-all", fontFamily: "ui-monospace, monospace", lineHeight: 1.5 }}>
              {finalUrl}
            </span>
          </div>
        )}
      </div>
      {qrBlock}
    </div>
  );
};

export default ShortLinkCard;
