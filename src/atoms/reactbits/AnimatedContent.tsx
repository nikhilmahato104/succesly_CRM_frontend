import React from "react";
import { motion, useReducedMotion } from "framer-motion";

// ReactBits-style "AnimatedContent": content glides in from an offset with a
// spring + fade when it mounts. Respects prefers-reduced-motion.

export interface AnimatedContentProps {
  children:   React.ReactNode;
  /** Start offset in px (default 24) */
  distance?:  number;
  direction?: "vertical" | "horizontal";
  reverse?:   boolean;
  /** Seconds before the animation starts (default 0) */
  delay?:     number;
  /** Starting scale (default 1) */
  scale?:     number;
  className?: string;
  style?:     React.CSSProperties;
}

export const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children, distance = 24, direction = "vertical", reverse = false,
  delay = 0, scale = 1, className, style,
}) => {
  const reduce = useReducedMotion();
  const offset = reverse ? -distance : distance;
  const from   = direction === "vertical" ? { y: offset } : { x: offset };

  if (reduce) return <div className={className} style={style}>{children}</div>;

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale, ...from }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.8, delay }}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedContent;
