import React, { useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CleanSelectProps {
  label?:        React.ReactNode;
  value?:        string;
  defaultValue?: string;
  onChange?:     (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?:       (e: React.FocusEvent<HTMLSelectElement>) => void;
  options:       SelectOption[];
  placeholder?:  string;   // renders as disabled first option
  error?:        string;
  hint?:         string;
  disabled?:     boolean;
  required?:     boolean;
  style?:        React.CSSProperties;
  selectStyle?:  React.CSSProperties;
  name?:         string;
  id?:           string;
}

export const CleanSelect: React.FC<CleanSelectProps> = ({
  label,
  value,
  defaultValue,
  onChange,
  onBlur,
  options,
  placeholder,
  error,
  hint,
  disabled  = false,
  required  = false,
  style,
  selectStyle,
  name,
  id,
}) => {
  const [focused, setFocused] = useState(false);

  const selectBaseStyle: React.CSSProperties = {
    width:        "100%",
    height:       "var(--fi-height)",
    padding:      "0 32px 0 10px",
    background:   "var(--fi-bg)",
    border:       `1px solid ${error ? "var(--fi-border-error)" : focused ? "var(--fi-border-focus)" : "var(--fi-border)"}`,
    borderRadius: "var(--fi-radius)",
    boxShadow:    focused && !error ? "var(--fi-shadow-focus)" : "none",
    fontSize:     "var(--fi-font-size)",
    color:        value || !placeholder ? "var(--fi-text)" : "var(--fi-muted)",
    outline:      "none",
    transition:   "border-color 140ms ease, box-shadow 140ms ease",
    opacity:      disabled ? 0.5 : 1,
    cursor:       disabled ? "not-allowed" : "pointer",
    appearance:   "none",
    WebkitAppearance: "none",
    boxSizing:    "border-box",
    ...selectStyle,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 12, fontWeight: 500, color: "var(--fi-label)", userSelect: "none" }}
        >
          {label}
          {required && <span style={{ color: "var(--fi-border-error)", marginLeft: 2 }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        <select
          id={id}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          onFocus={() => setFocused(true)}
          disabled={disabled}
          required={required}
          style={selectBaseStyle}
        >
          {placeholder && (
            <option value="" disabled>{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <span
          style={{
            position:      "absolute",
            right:         10,
            top:           "50%",
            transform:     "translateY(-50%)",
            pointerEvents: "none",
            color:         "var(--fi-muted)",
            display:       "flex",
            alignItems:    "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {error && (
        <span style={{ fontSize: 11, color: "var(--fi-border-error)" }}>{error}</span>
      )}
      {!error && hint && (
        <span style={{ fontSize: 11, color: "var(--fi-muted)" }}>{hint}</span>
      )}
    </div>
  );
};

export default CleanSelect;
