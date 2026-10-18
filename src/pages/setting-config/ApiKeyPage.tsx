import React from "react";
import { Key } from "lucide-react";
import ApiKeyManagement from "./ApiKeyManagement";

const ApiKeyPage: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--dt-bg)" }}>

    {/* ── Header ──────────────────────────────────────────────────────────── */}
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderBottom: "1px solid var(--sc-border)",
      flexShrink: 0, background: "var(--sc-card)",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "var(--radius)",
        background: "rgba(99,102,241,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1",
      }}>
        <Key size={15} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--dt-text)", lineHeight: 1.2 }}>API Key Management</div>
        <div style={{ fontSize: 11, color: "var(--dt-muted)" }}>Manage your platform API keys and access credentials</div>
      </div>
    </div>

    {/* ── Content ──────────────────────────────────────────────────────────── */}
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <ApiKeyManagement />
    </div>
  </div>
);

export default ApiKeyPage;
