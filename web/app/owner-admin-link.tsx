"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LOCAL_MANAGER_STATUS = "http://127.0.0.1:17321/api/status";

export function OwnerAdminLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(LOCAL_MANAGER_STATUS, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = await response.json() as { adminAccess?: boolean };
        return body.adminAccess === true;
      })
      .then(setVisible)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return visible ? <Link href="/admin">管理员数据</Link> : null;
}
