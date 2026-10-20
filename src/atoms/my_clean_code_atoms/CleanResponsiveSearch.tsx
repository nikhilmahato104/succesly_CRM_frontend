import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useDevice } from "../../hooks/useDevice";
import { CleanSearchBar } from "./CleanSearchBar";

/**
 * CleanResponsiveSearch
 *   Desktop → the regular inline CleanSearchBar.
 *   Mobile  → a floating search button above the bottom bar; tapping it opens
 *             a search box centred in the visible viewport (above the keyboard).
 *             Pass `mobileFilter` to stack a round filter button above it —
 *             the page hides its own toolbar filter button on mobile.
 *
 * The FAB is rendered in place (position: fixed), so it disappears together
 * with a parent hidden via display:none — e.g. inactive SettingConfig tabs.
 */

export interface CleanResponsiveSearchProps {
  value:        string;
  onChange:     (value: string) => void;
  placeholder?: string;
  /** Desktop inline width */
  width?:       number | string;
  /** Desktop inline style — passed through to CleanSearchBar */
  style?:       React.CSSProperties;
  /** Mobile only: floating filter button stacked above the search button */
  mobileFilter?: { onClick: () => void; activeCount?: number };
}

const OVERLAY_Z = 9000;   // above the bottom bar (700), below CleanModal (9999)
const FAB_Z     = 650;    // above page content, below the bottom bar
const FADE_MS   = 180;
const FAB_SIZE  = 48;
const FAB_GAP   = 12;
const FAB_BASE  = 126;    // px above the viewport bottom — sits above the table pager circle

// ── Round floating button ──────────────────────────────────────────────────────

const FloatingButton: React.FC<{
  label:     string;
  icon:      React.ReactNode;
  slot:      number;              // 0 = lowest, 1 = stacked above it, …
  active:    boolean;
  hidden?:   boolean;
  badge?:    React.ReactNode;
  onClick:   () => void;
}> = ({ label, icon, slot, active, hidden, badge, onClick }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    style={{
      position:       "fixed",
      right:          16,
      bottom:         `calc(${FAB_BASE + slot * (FAB_SIZE + FAB_GAP)}px + env(safe-area-inset-bottom, 0px))`,
      zIndex:         FAB_Z,
      width:          FAB_SIZE,
      height:         FAB_SIZE,
      borderRadius:   "50%",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      background:     "var(--modal-bg)",
      border:         `1px solid ${active ? "var(--primary)" : "var(--fi-border)"}`,
      color:          active ? "var(--primary)" : "var(--fi-text)",
      boxShadow:      "0 6px 20px rgba(0,0,0,0.3)",
      cursor:         "pointer",
      opacity:        hidden ? 0 : 1,
      pointerEvents:  hidden ? "none" : "auto",
      transition:     `opacity ${FADE_MS}ms ease`,
      WebkitTapHighlightColor: "transparent",
    }}
  >
    {icon}
    {badge}
  </button>
);

const MobileSearch: React.FC<CleanResponsiveSearchProps> = ({ value, onChange, placeholder = "Search…", mobileFilter }) => {
  const [open, setOpen] = useState(false);
  const inputRef        = useRef<HTMLInputElement>(null);
  const hasValue        = value.length > 0;

  // flushSync makes the overlay visible before focus() — still inside the tap
  // gesture, so iOS Safari opens the keyboard.
  const openSearch = () => {
    flushSync(() => setOpen(true));
    inputRef.current?.focus();
  };

  const closeSearch = useCallback(() => {
    inputRef.current?.blur();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeSearch]);

  return (
    <>
      {/* ── Floating filter + search buttons ───────────────────────────── */}
      {mobileFilter && (
        <FloatingButton
          label="Filters"
          slot={1}
          icon={<SlidersHorizontal style={{ width: 19, height: 19 }} />}
          active={!!mobileFilter.activeCount}
          hidden={open}
          onClick={mobileFilter.onClick}
          badge={!!mobileFilter.activeCount && (
            <span style={{
              position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 99, boxSizing: "border-box", background: "var(--primary)", color: "#ffffff",
              fontSize: 10, fontWeight: 700, lineHeight: "18px", textAlign: "center",
            }}>
              {mobileFilter.activeCount}
            </span>
          )}
        />
      )}
      <FloatingButton
        label="Search"
        slot={0}
        icon={<Search style={{ width: 20, height: 20 }} />}
        active={hasValue}
        hidden={open}
        onClick={openSearch}
        badge={hasValue && (
          <span style={{
            position: "absolute", top: 9, right: 9, width: 8, height: 8,
            borderRadius: "50%", background: "var(--primary)", border: "2px solid var(--modal-bg)",
          }} />
        )}
      />

      {/* ── Centred search overlay ─────────────────────────────────────── */}
      {createPortal(
        <div
          aria-hidden={!open}
          onClick={closeSearch}
          style={{
            position:             "fixed",
            top:                  0,
            left:                 0,
            right:                0,
            // --vh tracks the visual viewport (useIOSViewport), so the box
            // stays centred in the area above the on-screen keyboard
            height:               "calc(var(--vh, 1dvh) * 100)",
            zIndex:               OVERLAY_Z,
            display:              "flex",
            flexDirection:        "column",
            alignItems:           "center",
            justifyContent:       "center",
            padding:              16,
            boxSizing:            "border-box",
            background:           "rgba(0,0,0,0.45)",
            backdropFilter:       "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            opacity:              open ? 1 : 0,
            visibility:           open ? "visible" : "hidden",
            pointerEvents:        open ? "auto" : "none",
            transition:           open
              ? `opacity ${FADE_MS}ms ease`
              : `opacity ${FADE_MS}ms ease, visibility 0s linear ${FADE_MS}ms`,
          }}
        >
          <form
            role="search"
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); closeSearch(); }}
            style={{
              width:        "100%",
              maxWidth:     480,
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              height:       52,
              padding:      "0 6px 0 16px",
              boxSizing:    "border-box",
              borderRadius: 16,
              background:   "var(--modal-bg)",
              border:       "1px solid var(--fi-border-focus)",
              boxShadow:    "0 16px 48px rgba(0,0,0,0.4)",
              transform:    open ? "scale(1)" : "scale(0.96)",
              transition:   `transform ${FADE_MS}ms ease`,
            }}
          >
            <Search style={{ width: 18, height: 18, color: "var(--fi-border-focus)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              tabIndex={open ? 0 : -1}
              style={{
                flex: 1, minWidth: 0, height: "100%", padding: 0,
                background: "transparent", border: "none", outline: "none",
                fontSize: 16, // ≥16px stops iOS from zooming into the field
                color: "var(--fi-text)",
              }}
            />
            <button
              type="button"
              aria-label={hasValue ? "Clear search" : "Close search"}
              tabIndex={open ? 0 : -1}
              onClick={() => (hasValue ? (onChange(""), inputRef.current?.focus()) : closeSearch())}
              style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: "var(--radius)",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer", color: "var(--fi-muted)",
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </form>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            Tap outside or press search to see results
          </p>
        </div>,
        document.body,
      )}
    </>
  );
};

export const CleanResponsiveSearch: React.FC<CleanResponsiveSearchProps> = (props) => {
  const { isMobile } = useDevice();
  if (isMobile) return <MobileSearch {...props} />;
  return (
    <CleanSearchBar
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      width={props.width ?? 260}
      style={props.style}
    />
  );
};

export default CleanResponsiveSearch;
