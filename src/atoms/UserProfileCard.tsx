/**
 * UserProfileCard — reusable floating profile card.
 *
 * Usage:
 *   const [cardAnchor, setCardAnchor] = useState<{ el: HTMLElement; user: CardUser } | null>(null);
 *
 *   <div onClick={e => setCardAnchor({ el: e.currentTarget, user })} style={{ cursor: "pointer" }}>
 *     <Avatar />
 *   </div>
 *
 *   <UserProfileCard
 *     user={cardAnchor?.user ?? null}
 *     anchorEl={cardAnchor?.el ?? null}
 *     onClose={() => setCardAnchor(null)}
 *   />
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, ShieldCheck } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CardUser {
  name: string;
  email?: string;
  role?: string;
  profile_image_url?: string | null;
}

interface UserProfileCardProps {
  user:     CardUser | null;
  anchorEl: HTMLElement | null;
  onClose:  () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────────────

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, anchorEl, onClose }) => {
  const cardRef            = useRef<HTMLDivElement>(null);
  const [pos, setPos]      = useState({ top: 0, left: 0, placement: "below" as "below" | "above" });
  const [imgFailed, setImgFailed] = useState(false);
  const [visible,   setVisible]   = useState(false);

  // Recompute position whenever anchor changes
  useEffect(() => {
    setImgFailed(false);
    if (!anchorEl) { setVisible(false); return; }

    const rect = anchorEl.getBoundingClientRect();
    const CARD_H = 240;
    const CARD_W = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth  - rect.left;

    const placement = spaceBelow >= CARD_H ? "below" : "above";
    const top  = placement === "below" ? rect.bottom + 6 : rect.top - CARD_H - 6;
    const left = Math.min(rect.left, window.innerWidth - CARD_W - 12);

    setPos({ top, left, placement });
    // small delay so the card mounts before the fade-in starts
    requestAnimationFrame(() => setVisible(true));
  }, [anchorEl]);

  // Close on outside click
  useEffect(() => {
    if (!anchorEl) return;
    const handler = (e: MouseEvent) => {
      if (
        cardRef.current && !cardRef.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [anchorEl, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!anchorEl) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [anchorEl, onClose]);

  if (!user || !anchorEl) return null;

  const showImg = !!user.profile_image_url && !imgFailed;

  const card = (
    <div
      ref={cardRef}
      style={{
        position:      "fixed",
        top:           pos.top,
        left:          pos.left,
        zIndex:        99999,
        width:         260,
        background:    "var(--modal-bg)",
        border:        "1px solid var(--sc-border)",
        borderRadius:  14,
        boxShadow:     "0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
        overflow:      "hidden",
        opacity:       visible ? 1 : 0,
        transform:     visible
          ? "translateY(0) scale(1)"
          : pos.placement === "below"
            ? "translateY(-6px) scale(0.97)"
            : "translateY(6px) scale(0.97)",
        transition:    "opacity 0.15s ease, transform 0.15s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {/* ── Top banner (gradient backdrop) ─────────────────────────────── */}
      <div style={{
        height:     56,
        background: "linear-gradient(135deg, var(--btn-primary-bg) 0%, var(--sc-surface) 100%)",
        flexShrink: 0,
      }} />

      {/* ── Avatar — overlaps the banner ───────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -44, paddingBottom: 20, paddingLeft: 16, paddingRight: 16, gap: 10 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          border: "3px solid var(--modal-bg)",
          overflow: "hidden", flexShrink: 0,
          background: showImg ? "transparent" : "var(--btn-primary-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        }}>
          {showImg ? (
            <img
              src={user.profile_image_url!}
              alt={user.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 700, color: "var(--btn-primary-text)", lineHeight: 1 }}>
              {getInitials(user.name)}
            </span>
          )}
        </div>

        {/* ── Name ─────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", width: "100%" }}>
          <p style={{
            margin: "0 0 4px", fontSize: 15, fontWeight: 700,
            color: "var(--fi-text)", lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {user.name}
          </p>

          {/* ── Role badge ─────────────────────────────────────────────── */}
          {user.role && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
              <ShieldCheck size={11} style={{ color: "var(--badge-blue-text)", flexShrink: 0 }} />
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: "var(--badge-blue-text)",
                background: "var(--badge-blue-bg)",
                padding: "1px 8px", borderRadius: 99,
              }}>
                {user.role}
              </span>
            </div>
          )}
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        {user.email && (
          <div style={{ width: "100%", height: 1, background: "var(--sc-border)", margin: "2px 0" }} />
        )}

        {/* ── Email ────────────────────────────────────────────────────── */}
        {user.email && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
            <Mail size={12} style={{ color: "var(--fi-muted)", flexShrink: 0 }} />
            <span style={{
              fontSize: 12, color: "var(--fi-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user.email}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(card, document.body);
};

export default UserProfileCard;
