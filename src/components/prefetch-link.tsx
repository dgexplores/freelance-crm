"use client";

import Link from "next/link";
import { type ReactNode, useRef, useEffect } from "react";

type PrefetchLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
} & Omit<React.ComponentProps<typeof Link>, "href" | "children">;

export function PrefetchLink({
  href,
  children,
  className = "",
  prefetch = true,
  ...props
}: PrefetchLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!prefetch) return;
    const link = linkRef.current;
    if (!link) return;

    const handleMouseEnter = () => {
      // Next.js Link component has prefetch method on the underlying anchor
      (link as HTMLAnchorElement & { prefetch?: () => void }).prefetch?.();
    };

    link.addEventListener("mouseenter", handleMouseEnter);
    return () => link.removeEventListener("mouseenter", handleMouseEnter);
  }, [prefetch]);

  return (
    <Link
      ref={linkRef}
      href={href}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
}