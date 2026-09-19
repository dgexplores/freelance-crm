"use client";

import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { type ReactNode } from "react";

export const spring = {
  default: { type: "spring" as const, bounce: 0, duration: 0.4 },
  snappy: { type: "spring" as const, bounce: 0, duration: 0.25 },
  momentum: { type: "spring" as const, bounce: 0.2, duration: 0.4 },
  settle: { type: "spring" as const, bounce: 0, duration: 0.5 },
} as const;

export function reducedMotionVariants(base: MotionProps["animate"]) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return { ...(base as object), transition: { duration: 0.15, ease: "easeOut" } };
  }
  return base;
}

export function RiseIn({
  children,
  className = "",
  delay = 0,
}: { children: ReactNode; className?: string; delay?: number }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReduced ? { opacity: 0 } : { y: 32, opacity: 0 }}
      animate={prefersReduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: prefersReduced ? 0.2 : 0.6,
        delay,
      }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

export function ScrubWords({
  text,
  className = "",
}: { text: string; className?: string }) {
  const prefersReduced = useReducedMotion();
  const words = text.split(" ");

  if (prefersReduced) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0.12 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4, delay: i * 0.04 }}
        >
          {w}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </p>
  );
}

export function ScaleMedia({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      initial={prefersReduced ? { opacity: 0 } : { scale: 0.82, opacity: 0.4 }}
      whileInView={prefersReduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ type: "spring", bounce: 0, duration: prefersReduced ? 0.2 : 0.7 }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

export function PinWrap({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}