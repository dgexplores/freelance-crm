"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteLoader() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!document.startViewTransition) return;

    const handleBeforeNavigate = () => setIsLoading(true);
    const handleAfterNavigate = () => setIsLoading(false);

    window.addEventListener("beforeNavigate", handleBeforeNavigate);
    window.addEventListener("afterNavigate", handleAfterNavigate);

    return () => {
      window.removeEventListener("beforeNavigate", handleBeforeNavigate);
      window.removeEventListener("afterNavigate", handleAfterNavigate);
    };
  }, [pathname]);

  if (!isLoading) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-lime via-emerald to-blue z-50 animate-progress"
      style={{ transformOrigin: "left", animation: "progress 0.3s ease-out forwards" }}
      aria-hidden="true"
    />
  );
}