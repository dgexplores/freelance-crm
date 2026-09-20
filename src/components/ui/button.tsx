"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "cta";
  asChild?: boolean;
  disableScale?: boolean; // disable scale on press/hover
};

const variants = {
  primary: "bg-white text-zinc-950 hover:bg-white/90 active:bg-white shadow-[0_8px_40px_rgba(255,255,255,0.15)]",
  secondary: "bg-white/10 text-white border border-white/20 hover:bg-white/15 active:bg-white/20 backdrop-blur",
  ghost: "text-white hover:bg-white/10 active:bg-white/15",
  cta: "bg-lime text-ink hover:bg-lime/90 active:bg-lime shadow-[0_8px_40px_rgba(217,245,76,0.3)]",
};

const baseClass = "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-colors";

// Motion tokens from transitions-dev
const TAP_SCALE = 0.96;
const HOVER_SCALE = 1.02;
const SPRING_FAST = { type: "spring" as const, bounce: 0, duration: 0.25 };

// Helper to omit problematic event handlers that conflict with Framer Motion
function cleanProps<T extends Record<string, unknown>>(props: T) {
  const {
    onDrag, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop,
    onAnimationStart, onAnimationEnd, onAnimationIteration,
    onTransitionStart, onTransitionEnd, onTransitionCancel,
    ...rest
  } = props;
  return rest;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", asChild = false, disableScale = false, children, ...props }, ref) => {
    const prefersReduced = useReducedMotion();

    const tapScale = disableScale || prefersReduced ? 1 : TAP_SCALE;
    const hoverScale = prefersReduced ? 1 : HOVER_SCALE;
    const transition = prefersReduced ? { duration: 0.15, ease: "easeOut" as const } : SPRING_FAST;

    const sharedProps = {
      className: `${baseClass} ${variants[variant]} ${className}`,
      whileTap: { scale: tapScale },
      whileHover: { scale: hoverScale },
      transition: prefersReduced ? { duration: 0.15, ease: "easeOut" as const } : SPRING_FAST,
      style: { willChange: "transform" },
    } as const;

    // Clean props to avoid Framer Motion type conflicts
    const cleanChildProps = cleanProps(props);

    if (asChild) {
      return (
        <motion.span
          ref={ref as React.RefObject<HTMLSpanElement>}
          {...sharedProps}
          {...cleanChildProps}
        >
          {children}
        </motion.span>
      );
    }

    return (
      <motion.button
        ref={ref}
        {...sharedProps}
        {...cleanChildProps}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = "Button";