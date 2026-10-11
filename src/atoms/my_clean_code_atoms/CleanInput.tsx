import React, { useState } from "react";

export interface CleanInputProps {
  type?:        "text" | "email" | "password" | "url" | "number" | "date" | "datetime-local";
  label?:       React.ReactNode;
  placeholder?: string;
  value?:       string;
  defaultValue?: string;
  onChange?:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?:      (e: React.FocusEvent<HTMLInputElement>) => void;
  error?:       string;
  hint?:        string;
  disabled?:    boolean;
  required?:    boolean;
  readOnly?:    boolean;
  prefix?:      React.ReactNode;   // icon/text before input
  suffix?:      React.ReactNode;   // icon/text after input
  style?:       React.CSSProperties;
  inputStyle?:  React.CSSProperties;
  name?:        string;
  id?:          string;
  min?:         string | number;
  max?:         string | number;
  step?:        string | number;
  autoComplete?: string;
  autoFocus?:   boolean;
}

export const CleanInput: React.FC<CleanInputProps> = ({
  type         = "text",
  label,
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  error,
  hint,
  disabled     = false,
  required     = false,
  readOnly     = false,
  prefix,
  suffix,
  style,
  inputStyle,
  name,
  id,
  min,
  max,
  step,
  autoComplete,
  autoFocus,
}) => {
  const [focused, setFocused] = useState(false);

  const wrapStyle: React.CSSProperties = {
    position:    "relative",
    display:     "flex",
    alignItems:  "center",
    height:      "var(--fi-height)",
    background:  "var(--fi-bg)",
    border:      `1px solid ${error ? "var(--fi-border-error)" : focused ? "var(--fi-border-focus)" : "var(--fi-border)"}`,
    borderRadius: "var(--fi-radius)",
    boxShadow:   focused && !error ? "var(--fi-shadow-focus)" : "none",
    transition:  "border-color 140ms ease, box-shadow 140ms ease",
    opacity:     disabled ? 0.5 : 1,
    boxSizing:   "border-box",
  };

  const inputBaseStyle: React.CSSProperties = {
    flex:        1,
    minWidth:    0,
    height:      "100%",
    padding:     prefix ? "0 10px 0 0" : "0 10px",
    paddingLeft: prefix ? 0 : 10,
    background:  "transparent",
    border:      "none",
    outline:     "none",
    fontSize:    "var(--fi-font-size)",
    color:       "var(--fi-text)",
    cursor:      readOnly ? "default" : "text",
    ...inputStyle,
  };

  const adornStyle: React.CSSProperties = {
    display:     "flex",
    alignItems:  "center",
    justifyContent: "center",
    padding:     "0 8px",
    color:       "var(--fi-muted)",
    flexShrink:  0,
    fontSize:    13,
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

      <div style={wrapStyle}>
        {prefix && <span style={adornStyle}>{prefix}</span>}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onChange={onChange}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          onFocus={() => setFocused(true)}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          min={min}
          max={max}
          step={step}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          style={inputBaseStyle}
        />
        {suffix && <span style={adornStyle}>{suffix}</span>}
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

export default CleanInput;
