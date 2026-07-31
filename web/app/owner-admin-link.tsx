"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const LOCAL_MANAGER_STATUS = "http://127.0.0.1:17321/api/status";
const SITE_ADMIN_STATUS = "/api/admin/access";

async function hasAdminAccess(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) return false;
  const body = await response.json() as { adminAccess?: boolean };
  return body.adminAccess === true;
}

type OwnerAdminLinkProps = {
  children: ReactNode;
  className?: string;
};

export function OwnerAdminLink({ children, className }: OwnerAdminLinkProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    for (const statusUrl of [LOCAL_MANAGER_STATUS, SITE_ADMIN_STATUS]) {
      hasAdminAccess(statusUrl, controller.signal)
        .then((allowed) => {
          if (allowed) setVisible(true);
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, []);

  return visible ? (
    <Link className={className} href="/admin" aria-label="打开月海后台监控">
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
