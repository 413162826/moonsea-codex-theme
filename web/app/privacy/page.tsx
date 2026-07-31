import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "月海匿名访问、下载与安装统计的范围和用途。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="themes-shell">
      <SiteHeader />
      <main className="legal-page">
        <p className="eyebrow">PRIVACY / MEASUREMENT</p>
        <h1>只记录理解产品所需的最少信息。</h1>
        <p>
          月海使用一年期第一方随机标识区分独立浏览器访客和重复下载。
          服务端只保存随机标识的 SHA-256 摘要，不保存原始标识。
        </p>
        <h2>我们记录什么</h2>
        <ul>
          <li>公开页面访问、首次来源与活动参数。</li>
          <li>匿名浏览器是否重复访问或重复下载。</li>
          <li>月海运行时的随机安装标识、系统、架构、版本和上报时间。</li>
        </ul>
        <h2>我们不记录什么</h2>
        <ul>
          <li>不采集硬件指纹、Codex 账号、邮箱、提示词或项目内容。</li>
          <li>业务数据库不保存原始 IP 和完整 User-Agent。</li>
          <li>不会把匿名统计用于广告画像或向第三方出售。</li>
        </ul>
        <p>
          更换浏览器或清除本站数据后，会被视为新的独立浏览器访客。
          因此这里的“访客”不是实名用户或自然人数量。
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
