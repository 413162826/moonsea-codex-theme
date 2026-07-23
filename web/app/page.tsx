import Link from "next/link";
import { ThemeGallery } from "./theme-gallery";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="月海主题首页">
            <span className="brand-mark" aria-hidden="true">◐</span>
            <span>月海</span>
          </Link>
          <nav className="site-nav" aria-label="主要导航">
            <a href="#themes">主题墙</a>
            <a href="#privacy">使用统计</a>
            <a className="download-link" href="https://github.com/413162826/moonsea-codex-theme/releases/latest/download/Moonsea-Codex-Windows-x64.zip">
              下载 Windows 版
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">MOONSEA FOR CODEX</p>
          <h1>给 Codex 换一张<br />真正融入界面的壁纸。</h1>
          <p className="hero-copy">
            免费渐变与 Pro 精选壁纸共享同一套月海渲染。打开月海版后，
            在这里挑选并立即应用，不需要重启。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#themes">浏览主题</a>
            <a className="secondary-action" href="https://github.com/413162826/moonsea-codex-theme">查看 GitHub</a>
          </div>
        </section>

        <ThemeGallery />

        <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
          <div>
            <p className="section-kicker">隐私优先</p>
            <h2 id="privacy-title">统计使用量，不读取 Codex 账号。</h2>
          </div>
          <div className="privacy-copy">
            <p>
              使用统计默认关闭。只有你在月海助手中主动开启后，才会上报随机安装标识、
              月海版本、操作系统与最近活跃时间。
            </p>
            <p>不会上传 Codex 账号、邮箱、提示词、项目名称、文件路径或壁纸内容。</p>
          </div>
        </section>
      </main>

      <footer>
        <p>月海 · 为 Codex 打造的主题与壁纸体验</p>
        <div>
          <Link href="/admin">管理员数据</Link>
          <a href="https://github.com/413162826/moonsea-codex-theme">GitHub</a>
        </div>
      </footer>
    </>
  );
}
