"use client";

import { motion, useReducedMotion } from "motion/react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Subtle fade-up on mount; respects prefers-reduced-motion. */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Reduced motion: same SSR markup, but the reveal is instant.
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
