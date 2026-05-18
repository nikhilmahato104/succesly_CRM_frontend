import React from "react";

export interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

/** Atomic skeleton building block — uses .sk-pulse shimmer from index.css */
export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = "100%",
  height = 14,
  borderRadius = 4,
  circle = false,
  style,
}) => (
  <div
    className="sk-pulse"
    style={{
      width,
      height,
      borderRadius: circle ? "50%" : borderRadius,
      flexShrink: 0,
      ...style,
    }}
  />
);
