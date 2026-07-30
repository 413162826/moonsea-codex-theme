import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../site-chrome";

export const metadata: Metadata = {
  title: "选择下载版本",
  description: "选择适合当前电脑的月海安装包",
  robots: { index: false, follow: false },
};

type ChooseProps = { searchParams: Promise<{ client?: string }> };

export default async function DownloadChoosePage({ searchParams }: ChooseProps) {
  const { client } = await searchParams;
  const clientParam = client === "workbuddy" ? "workbuddy" : "codex";
  const tone = clientParam === "workbuddy" ? "workbuddy" : "moonsea";
  const withClient = (platform: string) => `/download?platform=${platform}&client=${clientParam}`;
  return (
    <>
      <SiteHeader tone={tone} />
      <main className="download-choose">
        <p>没有识别出当前系统</p>
        <h1>选择你的电脑</h1>
        <div className="download-choose__actions">
          <a href={withClient("windows")}>Windows</a>
          <a href={withClient("macos")}>macOS</a>
        </div>
        <Link href="/">返回月海首页</Link>
      </main>
    </>
  );
}
