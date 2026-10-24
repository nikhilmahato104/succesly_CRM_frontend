import React, { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CleanInput } from "../../../atoms/my_clean_code_atoms";
import { MAX_CONCURRENCY, MAX_TARGET_KB, MIN_TARGET_KB, MODE_OPTIONS, TARGET_PRESETS_KB } from "../config";
import type { ConverterSettings } from "../types";
import { validateTargetKb } from "../utils/validation";
import styles from "../imageConverter.module.css";

interface SettingsPanelProps {
  settings: ConverterSettings;
  onChange: (patch: Partial<ConverterSettings>) => void;
  /** Encoding settings are locked during a batch; concurrency stays adjustable */
  locked:   boolean;
  engineKind: "worker" | "main-thread" | null;
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--fi-label)", marginBottom: 6 };
const hintStyle:  React.CSSProperties = { margin: "4px 0 0", fontSize: 11, color: "var(--fi-muted)", lineHeight: 1.4 };

const isPreset = (kb: number) => (TARGET_PRESETS_KB as readonly number[]).includes(kb);

/** Number field that only commits valid values, so settings never hold garbage */
const NumberSetting: React.FC<{
  label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  hint?: string; disabled?: boolean; onCommit: (n: number) => void;
}> = ({ label, value, min, max, step = 1, suffix, hint, disabled, onCommit }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const n = Number(draft);
  const error = draft.trim() === "" || !Number.isFinite(n) || n < min || n > max ? `Use ${min}–${max}.` : undefined;

  return (
    <CleanInput
      type="number" label={label} value={draft} min={min} max={max} step={step} suffix={suffix}
      disabled={disabled} error={error} hint={error ? undefined : hint}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) onCommit(Math.round(v / step) * step);
      }}
      onBlur={() => { if (error) setDraft(String(value)); }}
    />
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, locked, engineKind }) => {
  const [customMode, setCustomMode] = useState(() => !isPreset(settings.targetKb));
  const [customDraft, setCustomDraft] = useState(String(settings.targetKb));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();

  const customError = customMode ? validateTargetKb(customDraft) : null;

  const pickPreset = (kb: number) => {
    setCustomMode(false);
    onChange({ targetKb: kb });
  };

  const pct = (q: number) => `${Math.round(q * 100)}`;

  const processingInfo = (
    <>
      <span style={labelStyle}>Processing</span>
      <p style={{ ...hintStyle, marginTop: 0, fontSize: 12 }}>
        {engineKind === "worker" && "Runs in background Web Workers — the page stays responsive. Nothing is uploaded; images never leave your device."}
        {engineKind === "main-thread" && "This browser can't encode WebP in a background worker, so images are processed on the page itself (at most 2 at a time). Nothing is uploaded."}
        {engineKind === null && "Checking browser support…"}
      </p>
      <p style={hintStyle}>Metadata (EXIF, GPS) is removed. Orientation is applied to the pixels.</p>
    </>
  );

  return (
    <section className={styles.panel} aria-labelledby={`${advancedId}-title`}>
      <h2 id={`${advancedId}-title`} style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--fi-text)" }}>
        Compression settings
      </h2>

      <div className={styles.settingsGrid}>
        {/* ── Target size ── */}
        <div>
          <span style={labelStyle} id={`${advancedId}-target`}>Target size per image</span>
          <div className={`${styles.chips} ${styles.chipsScroll}`} role="group" aria-labelledby={`${advancedId}-target`} data-no-swipe>
            {TARGET_PRESETS_KB.map(kb => (
              <button
                key={kb} type="button" className={styles.chip} disabled={locked}
                aria-pressed={!customMode && settings.targetKb === kb}
                onClick={() => pickPreset(kb)}
              >
                {kb} KB
              </button>
            ))}
            <button
              type="button" className={styles.chip} disabled={locked} aria-pressed={customMode}
              onClick={() => { setCustomMode(true); setCustomDraft(String(settings.targetKb)); }}
            >
              Custom
            </button>
          </div>
          {customMode && (
            <div style={{ marginTop: 10, maxWidth: 220 }}>
              <CleanInput
                type="number" label="Custom target" value={customDraft} min={MIN_TARGET_KB} max={MAX_TARGET_KB}
                suffix="KB" disabled={locked} error={customError ?? undefined} autoFocus
                onChange={(e) => {
                  setCustomDraft(e.target.value);
                  if (!validateTargetKb(e.target.value)) onChange({ targetKb: Math.round(Number(e.target.value)) });
                }}
              />
            </div>
          )}
          <p style={hintStyle}>
            1 KB = 1,024 bytes. A target can't always be reached — such images are flagged, never hidden.
          </p>
        </div>

        {/* ── Mode ── */}
        <div>
          <span style={labelStyle} id={`${advancedId}-mode`}>Compression mode</span>
          <div className={`${styles.chips} ${styles.segmented}`} role="radiogroup" aria-labelledby={`${advancedId}-mode`}>
            {MODE_OPTIONS.map(m => (
              <button
                key={m.value} type="button" role="radio" className={styles.chip} disabled={locked}
                aria-checked={settings.mode === m.value}
                onClick={() => onChange({ mode: m.value })}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p style={hintStyle}>{MODE_OPTIONS.find(m => m.value === settings.mode)?.hint}.</p>
        </div>

        {/* ── Engine info — on small screens it moves into Advanced to keep the panel short ── */}
        <div className={styles.desktopOnly}>{processingInfo}</div>
      </div>

      {/* ── Advanced ── */}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--sc-border)", paddingTop: 12 }}>
        <button
          type="button" className={styles.disclosure}
          aria-expanded={advancedOpen} aria-controls={`${advancedId}-adv`}
          onClick={() => setAdvancedOpen(o => !o)}
        >
          {advancedOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          Advanced settings
        </button>

        {advancedOpen && (
          <div id={`${advancedId}-adv`} className={styles.settingsGrid} style={{ marginTop: 12 }}>
            <div>
              <label style={labelStyle} htmlFor={`${advancedId}-minq`}>
                Minimum quality: {pct(settings.minQuality)}
              </label>
              <input
                id={`${advancedId}-minq`} type="range" className={styles.range}
                min={0.05} max={0.95} step={0.01} value={settings.minQuality} disabled={locked}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ minQuality: v, maxQuality: Math.max(v, settings.maxQuality) });
                }}
              />
              <p style={hintStyle}>The encoder never goes below this quality.</p>
            </div>

            <div>
              <label style={labelStyle} htmlFor={`${advancedId}-maxq`}>
                Maximum quality: {pct(settings.maxQuality)}
              </label>
              <input
                id={`${advancedId}-maxq`} type="range" className={styles.range}
                min={0.1} max={1} step={0.01} value={settings.maxQuality} disabled={locked}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onChange({ maxQuality: v, minQuality: Math.min(v, settings.minQuality) });
                }}
              />
              <p style={hintStyle}>Upper bound — the highest quality that fits the target is used.</p>
            </div>

            <NumberSetting
              label="Minimum dimension (longest side)" value={settings.minDimension} min={16} max={8192} suffix="px"
              disabled={locked} hint="Images are never shrunk below this. Smaller originals are never upscaled."
              onCommit={(n) => onChange({ minDimension: n })}
            />

            <NumberSetting
              label="Maximum dimension (longest side)" value={settings.maxDimension} min={0} max={16384} suffix="px"
              disabled={locked} hint="0 = keep original size. Larger images are scaled down first."
              onCommit={(n) => onChange({ maxDimension: n })}
            />

            <div className={styles.mobileOnly}>{processingInfo}</div>

            <NumberSetting
              label="Parallel conversions" value={settings.concurrency} min={1} max={MAX_CONCURRENCY}
              hint={engineKind === "main-thread" ? "Capped at 2 on this browser." : "More is faster but uses more memory. Can be changed while running."}
              onCommit={(n) => onChange({ concurrency: n })}
            />
          </div>
        )}
      </div>
    </section>
  );
};
