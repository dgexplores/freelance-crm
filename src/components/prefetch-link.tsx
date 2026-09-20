"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { type ReactNode, useRef, useEffect } from "react";

type PrefetchLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
  transitionName?: string;
  transitionEnter?: string;
  transitionExit?: string;
  transitionShare?: string;
  transitionDefault?: "auto" | "none";
} & Omit<React.ComponentProps<typeof Link>, "href" | "children">;

export function PrefetchLink({
  href,
  children,
  className = "",
  prefetch = true,
  transitionName,
  transitionEnter,
  transitionExit,
  transitionShare,
  transitionDefault = "none",
  ...props
}: PrefetchLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!prefetch) return;
    const link = linkRef.current;
    if (!link) return;

    const handleMouseEnter = () => {
      (link as HTMLAnchorElement & { prefetch?: () => void }).prefetch?.();
    };

    link.addEventListener("mouseenter", handleMouseEnter);
    return () => link.removeEventListener("mouseenter", handleMouseEnter);
  }, [prefetch]);

  const linkProps = {
    ref: linkRef,
    href,
    className,
    ...props,
  };

  if (transitionName) {
    return (
      <ViewTransition
        name={transitionName}
        enter={transitionEnter}
        exit={transitionExit}
        share={transitionShare}
        default={transitionDefault}
      >
        <Link {...linkProps}>{children}</Link>
      </ViewTransition>
    );
  }

  return <Link {...linkProps}>{children}</Link>;
}