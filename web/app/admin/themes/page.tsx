import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";
import { ThemeUploadForm } from "./theme-upload-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "发布主题",
  robots: { index: false, follow: false },
};

function allowedAdminEmails() {
  return new Set(
    String(env.MOONSEA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export default async function AdminThemesPage() {
  const user = await requireChatGPTUser("/admin/themes");
  if (!allowedAdminEmails().has(user.email.toLowerCase())) {
    return (
      <main className="admin-shell admin-denied">
        <p className="admin-status-code">403</p>
        <h1>这个账号没有发布权限。</h1>
        <a href={chatGPTSignOutPath("/admin/themes")}>切换账号</a>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>发布 Pro 壁纸</h1>
          <p>上传一次，主题墙与月海助手立即读取。</p>
        </div>
        <div className="admin-account">
          <span>{user.displayName}</span>
          <Link href="/admin">返回数据看板</Link>
        </div>
      </header>
      <section className="admin-section">
        <ThemeUploadForm />
      </section>
    </main>
  );
}
