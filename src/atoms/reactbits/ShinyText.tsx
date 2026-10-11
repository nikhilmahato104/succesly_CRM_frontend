import React from "react";

// ReactBits-style "ShinyText": a soft highlight band sweeps across the text.
// Pure CSS (gradient clipped to text) — keyframes live in index.css (.rb-shiny-text).

export interface ShinyTextProps {
  text:      string;
  /** Seconds per sweep (default 3) */
  speed?:    number;
  disabled?: boolean;
  className?: string;
  style?:    React.CSSProperties;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text, speed = 3, disabled = false, className = "", style,
}) => (
  <span
    className={`rb-shiny-text ${disabled ? "rb-shiny-text--off" : ""} ${className}`}
    style={{ animationDuration: `${speed}s`, ...style }}
  >
    {text}
  </span>
);

export default ShinyText;
