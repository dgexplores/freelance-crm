"use client";

import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { type ReactNode } from "react";

/* Motion tokens mapped from transitions-dev root CSS */
export const spring = {
  micro: { type: "spring" as const, bounce: 0, duration: 0.08 },
  quick: { type: "spring" as const, bounce: 0, duration: 0.15 },
  fast: { type: "spring" as const, bounce: 0, duration: 0.25 },
  default: { type: "spring" as const, bounce: 0, duration: 0.35 },
  medium: { type: "spring" as const, bounce: 0, duration: 0.4 },
  slow: { type: "spring" as const, bounce: 0, duration: 0.5 },
  momentum: { type: "spring" as const, bounce: 0.2, duration: 0.4 },
} as const;

export const easing = {
  smoothOut: [0.22, 1, 0.36, 1],
  inOut: "ease-in-out",
  out: "ease-out",
  linear: "linear",
  bounce: [0.34, 1.36, 0.64, 1],
  bounceStrong: [0.34, 3.85, 0.64, 1],
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
        duration: prefersReduced ? 0.15 : 0.35,
        delay,
        ease: easing.smoothOut,
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
          transition={{
            type: "spring",
            bounce: 0,
            duration: 0.35,
            delay: i * 0.04,
            ease: easing.smoothOut,
          }}
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
      transition={{
        type: "spring",
        bounce: 0,
        duration: prefersReduced ? 0.15 : 0.5,
        ease: easing.smoothOut,
      }}
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

/* Skeleton reveal with proper motion tokens */
export function SkeletonReveal({
  children,
  className = "",
  isLoading,
}: { children: ReactNode; className?: string; isLoading: boolean }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div className={className}>
      {isLoading ? (
        <motion.div
          className="skeleton"
          animate={prefersReduced ? {} : { backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 1.5, ease: easing.linear, repeat: Infinity }}
          style={{ backgroundSize: "200% 100%" }}
        />
      ) : (
        <motion.div
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: prefersReduced ? 0.15 : 0.35,
            ease: easing.smoothOut,
          }}
          style={{ willChange: "opacity, filter" }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}