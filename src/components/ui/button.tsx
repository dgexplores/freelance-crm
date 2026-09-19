"use client";

import { motion } from "framer-motion";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { spring } from "@/components/landing/motion";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "cta";
  asChild?: boolean;
};

const variants = {
  primary: "bg-white text-zinc-950 hover:bg-white/90 active:bg-white shadow-[0_8px_40px_rgba(255,255,255,0.15)]",
  secondary: "bg-white/10 text-white border border-white/20 hover:bg-white/15 active:bg-white/20 backdrop-blur",
  ghost: "text-white hover:bg-white/10 active:bg-white/15",
  cta: "bg-lime text-ink hover:bg-lime/90 active:bg-lime shadow-[0_8px_40px_rgba(217,245,76,0.3)]",
};

const baseClass = "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-colors";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", asChild = false, children, ...props }, ref) => {
    const motionProps = { ...props } as Record<string, unknown>;

    if (asChild) {
      return (
        <motion.span
          ref={ref as React.RefObject<HTMLSpanElement>}
          className={`${baseClass} ${variants[variant]} ${className}`}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          transition={spring.default}
          style={{ willChange: "transform" }}
          {...motionProps}
        >
          {children}
        </motion.span>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={`${baseClass} ${variants[variant]} ${className}`}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        transition={spring.default}
        style={{ willChange: "transform" }}
        {...motionProps}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = "Button";