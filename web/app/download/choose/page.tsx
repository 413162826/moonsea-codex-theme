import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../site-chrome";

export const metadata: Metadata = {
  title: "选择下载版本",
  description: "选择适合当前电脑的月海安装包",
  robots: { index: false, follow: false },
};

export default function DownloadChoosePage() {
  return (
    <>
      <SiteHeader tone="moonsea" />
      <main className="download-choose">
        <p>没有识别出当前系统</p>
        <h1>选择你的电脑</h1>
        <div className="download-choose__actions">
          <a href="/download?platform=windows">Windows</a>
          <a href="/download?platform=macos">macOS</a>
        </div>
        <Link href="/">返回月海首页</Link>
      </main>
    </>
  );
}
